import { randomBytes } from "node:crypto";
import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import * as V from "../lib/validation.js";
import { requireAuth, ah } from "../middleware/auth.js";
import { getRoute, haversineKm } from "../lib/geo.js";
import { planPickups, bookingOrderDistance } from "../lib/pickupPlan.js";

const router = Router();
router.use(requireAuth);

const point = V.point;

// Two minutes of slack. A driver publishing "leaving now" spends a few seconds
// on the form, and their device clock may differ slightly from the server's;
// neither should be treated as a past departure.
const DEPARTURE_GRACE_MS = 2 * 60 * 1000;

// Route Confirmation screen calls this before publishing or searching.
// When a vehicle is supplied it also returns a suggested fare, computed from
// the organisation's own fuel price and the vehicle's mileage — the admin's
// settings actually drive what a seat costs instead of sitting unused.
router.post(
  "/route-preview",
  ah(async (  
    req, res) => {
    const parsed = z
      .object({ origin: point, dest: point, vehicleId: z.string().optional(), seats: z.number().optional() })
      .safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "origin and dest are required" });

    const { origin, dest, vehicleId, seats } = parsed.data;
    const route = await getRoute(origin, dest);

    let suggestedFare = null;
    if (vehicleId) {
      const [vehicle, org] = await Promise.all([
        prisma.vehicle.findFirst({ where: { id: vehicleId, userId: req.user.id } }),
        prisma.organization.findUnique({ where: { id: req.user.orgId } }),
      ]);

      if (vehicle && org) {
        const km = route.distanceKm;
        const litres = km / (Number(vehicle.mileageKmpl) || 15);
        const fuelCost = litres * Number(org.fuelPricePerLitre);
        const wearCost = km * Number(org.travelCostPerKm);
        // Split across everyone aboard, driver included — the driver was making
        // the trip anyway, so riders share the cost rather than pay a fare.
        const occupants = (seats ?? 1) + 1;
        const perSeat = (fuelCost + wearCost) / occupants;

        suggestedFare = {
          amount: Math.max(10, Math.round(perSeat / 5) * 5),
          fuelCost: round2(fuelCost),
          wearCost: round2(wearCost),
          litres: round2(litres),
          basis: `${km} km at ${vehicle.mileageKmpl} km/l, fuel ₹${org.fuelPricePerLitre}/l, split ${occupants} ways`,
        };
      }
    }

    res.json({ ...route, suggestedFare });
  })
);

// A GPS fix. Coordinates are bounded, and the derived values are sanity-checked
// rather than trusted: a browser reporting 4,000 km/h has misread a sensor, and
// storing it would put an ETA of "arriving in 0 minutes" in front of a
// passenger for the rest of the journey.
const pingSchema = z.object({
  lat: V.latitude,
  lng: V.longitude,
  speedKmph: z.number().min(0).max(300).nullish(),
  heading: z.number().min(0).max(360).nullish(),
  accuracyM: z.number().min(0).max(100000).nullish(),
});

const publishSchema = z.object({
  vehicleId: z.string(),
  origin: point,
  dest: point,
  departureAt: V.isoDateTime,
  seats: z.number().int("Seats must be a whole number").min(1).max(8),
  // Capped: this is cost-sharing, and a five-figure "fare" for a city commute
  // is a typo or an attempt to game the fare guidance, never a real price.
  farePerSeat: V.money(5000, "Fare"),
  isRecurring: z.boolean().optional(),
  recurrenceDays: z.array(z.number().int().min(0).max(6)).optional(),
  womenOnly: z.boolean().optional(),
});

// ------------------------------------------------------------- publish a ride
router.post(
  "/",
  ah(async (req, res) => {
    const parsed = publishSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });
    const d = parsed.data;

    // Reject past departures. The validity check comes first: an unparseable
    // date yields NaN, and every comparison with NaN is false, so a range
    // check alone would let bad input reach the database.
    const departure = new Date(d.departureAt);
    if (Number.isNaN(departure.getTime())) {
      return res.status(400).json({ error: "Enter a valid departure date and time" });
    }
    if (departure.getTime() < Date.now() - DEPARTURE_GRACE_MS) {
      return res.status(400).json({ error: "Departure time must be in the future" });
    }

    // Vehicle must belong to the caller — never trust a client-supplied id.
    const vehicle = await prisma.vehicle.findFirst({
      where: { id: d.vehicleId, userId: req.user.id, isActive: true },
    });
    if (!vehicle) return res.status(400).json({ error: "Register a vehicle before offering a ride" });
    if (!vehicle.isApproved) {
      return res.status(403).json({ error: "This vehicle is not approved for ride sharing" });
    }
    if (d.seats > vehicle.seatingCapacity) {
      return res.status(400).json({
        error: `${vehicle.model} seats ${vehicle.seatingCapacity}; you offered ${d.seats}`,
      });
    }

    // Only a woman can run a women-only car. Checked here rather than trusted
    // from the client, because this is the flag the whole feature rests on.
    const womenOnly = d.womenOnly === true;
    if (womenOnly && req.user.gender !== "FEMALE") {
      return res.status(403).json({
        error: "Only a driver who has set their gender to female can offer a women-only ride",
      });
    }

    const route = await getRoute(d.origin, d.dest);

    const ride = await prisma.ride.create({
      data: {
        orgId: req.user.orgId,
        driverId: req.user.id,
        vehicleId: vehicle.id,
        originLabel: d.origin.label,
        originLat: d.origin.lat,
        originLng: d.origin.lng,
        destLabel: d.dest.label,
        destLat: d.dest.lat,
        destLng: d.dest.lng,
        departureAt: new Date(d.departureAt),
        totalSeats: d.seats,
        seatsLeft: d.seats,
        farePerSeat: d.farePerSeat,
        distanceKm: route.distanceKm,
        durationMin: route.durationMin,
        routeGeometry: route.geometry,
        isRecurring: d.isRecurring ?? false,
        recurrenceDays: d.recurrenceDays ?? [],
        womenOnly,
      },
      include: rideInclude,
    });

    res.status(201).json({ ride: shapeRide(ride), routeSource: route.source });
  })
);

// ------------------------------------------------------------------ search
// Matching: same org, seats available, departing in a window around the
// requested time, ranked by how far the driver's endpoints sit from the
// passenger's. Cheap, explainable, and good enough to look intelligent.
router.get(
  "/search",
  ah(async (req, res) => {
    const originLat = Number(req.query.originLat);
    const originLng = Number(req.query.originLng);
    const destLat = Number(req.query.destLat);
    const destLng = Number(req.query.destLng);
    const seats = Number(req.query.seats || 1);
    const when = req.query.departureAt ? new Date(req.query.departureAt) : new Date();

    if ([originLat, originLng, destLat, destLng].some(Number.isNaN)) {
      return res.status(400).json({ error: "origin and destination coordinates are required" });
    }

    // The window is centred on the requested time, but its lower bound is
    // clamped to now — otherwise searching at 6pm would surface rides that
    // left at noon. A search entirely in the past simply returns nothing.
    const windowHours = Number(req.query.windowHours || 6);
    const from = new Date(Math.max(when.getTime() - windowHours * 3600_000, Date.now()));
    const to = new Date(when.getTime() + windowHours * 3600_000);

    // Women-only rides are hidden from anyone who cannot book one, rather than
    // shown and refused at the point of booking. Listing a ride someone is not
    // allowed to take only advertises who is in the car.
    const canSeeWomenOnly = req.user.gender === "FEMALE";
    // A woman can additionally narrow the results to women-only rides.
    const womenOnlyRequested = req.query.womenOnly === "true";

    const rides = await prisma.ride.findMany({
      where: {
        orgId: req.user.orgId,
        status: "PUBLISHED",
        seatsLeft: { gte: seats },
        departureAt: { gte: from, lte: to },
        driverId: { not: req.user.id }, // never match a user to their own ride
        ...(canSeeWomenOnly
          ? womenOnlyRequested
            ? { womenOnly: true }
            : {}
          : { womenOnly: false }),
      },
      include: rideInclude,
      orderBy: { departureAt: "asc" },
      take: 100,
    });

    const MAX_DETOUR_KM = Number(req.query.maxDetourKm || 12);
    const scored = rides
      .map((r) => {
        const pickupKm = haversineKm(r.originLat, r.originLng, originLat, originLng);
        const dropKm = haversineKm(r.destLat, r.destLng, destLat, destLng);
        return { ride: r, pickupKm, dropKm, detourKm: pickupKm + dropKm };
      })
      .filter((m) => m.detourKm <= MAX_DETOUR_KM)
      .sort((a, b) => a.detourKm - b.detourKm);

    // One grouped query for every driver on screen, rather than one per card.
    const driverIds = [...new Set(scored.map((m) => m.ride.driverId))];
    const ratings = await prisma.rating.groupBy({
      by: ["driverId"],
      where: { driverId: { in: driverIds } },
      _avg: { stars: true },
      _count: true,
    });
    const ratingBy = new Map(
      ratings.map((r) => [
        r.driverId,
        { average: Math.round((r._avg.stars ?? 0) * 10) / 10, count: r._count },
      ])
    );

    res.json({
      count: scored.length,
      rides: scored.map((m) => ({
        ...shapeRide(m.ride),
        driverRating: ratingBy.get(m.ride.driverId) ?? { average: null, count: 0 },
        match: {
          pickupDistanceKm: round1(m.pickupKm),
          dropDistanceKm: round1(m.dropKm),
          detourKm: round1(m.detourKm),
        },
      })),
    });
  })
);

// Rides the caller is driving.
router.get(
  "/mine",
  ah(async (req, res) => {
    const rides = await prisma.ride.findMany({
      where: { driverId: req.user.id },
      include: rideInclude,
      orderBy: { departureAt: "desc" },
    });
    res.json({ rides: rides.map(shapeRide) });
  })
);

router.get(
  "/:id",
  ah(async (req, res) => {
    const ride = await prisma.ride.findFirst({
      where: { id: req.params.id, orgId: req.user.orgId },
      include: rideInclude,
    });
    if (!ride) return res.status(404).json({ error: "Ride not found" });
    res.json({ ride: shapeRide(ride) });
  })
);

// ------------------------------------------------------------ trip lifecycle
// Booked -> Started -> In Progress -> Completed, driver-only transitions.
const NEXT_STATUS = { PUBLISHED: "STARTED", STARTED: "IN_PROGRESS", IN_PROGRESS: "COMPLETED" };

router.post(
  "/:id/advance",
  ah(async (req, res) => {
    const ride = await prisma.ride.findFirst({
      where: { id: req.params.id, driverId: req.user.id },
    });
    if (!ride) return res.status(404).json({ error: "Ride not found or you are not the driver" });

    const next = NEXT_STATUS[ride.status];
    if (!next) return res.status(400).json({ error: `Cannot advance from ${ride.status}` });

    const updated = await prisma.ride.update({
      where: { id: ride.id },
      data: {
        status: next,
        startedAt: next === "STARTED" ? new Date() : ride.startedAt,
        completedAt: next === "COMPLETED" ? new Date() : ride.completedAt,
      },
      include: rideInclude,
    });

    // Completing the ride moves every booking to payment-pending territory.
    if (next === "COMPLETED") {
      await prisma.booking.updateMany({
        where: { rideId: ride.id, status: "BOOKED" },
        data: { status: "COMPLETED" },
      });
    }

    res.json({ ride: shapeRide(updated) });
  })
);

router.post(
  "/:id/cancel",
  ah(async (req, res) => {
    const ride = await prisma.ride.findFirst({
      where: { id: req.params.id, driverId: req.user.id },
    });
    if (!ride) return res.status(404).json({ error: "Ride not found" });
    if (["COMPLETED", "CANCELLED"].includes(ride.status)) {
      return res.status(400).json({ error: `Ride is already ${ride.status.toLowerCase()}` });
    }

    await prisma.$transaction([
      prisma.ride.update({ where: { id: ride.id }, data: { status: "CANCELLED" } }),
      prisma.booking.updateMany({
        where: { rideId: ride.id, status: "BOOKED" },
        data: { status: "CANCELLED" },
      }),
    ]);
    res.json({ ok: true });
  })
);

// ------------------------------------------------------------- live tracking
// Driver pushes position; passengers poll /track. Polling rather than sockets
// is deliberate — see the deployment notes. A dropped ping is harmless.
router.post(
  "/:id/ping",
  ah(async (req, res) => {
    const parsed = pingSchema.safeParse(req.body ?? {});
    if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });
    const { lat, lng, speedKmph, heading, accuracyM } = parsed.data;

    const ride = await prisma.ride.findFirst({
      where: { id: req.params.id, driverId: req.user.id },
      select: { id: true, status: true },
    });
    if (!ride) return res.status(404).json({ error: "Ride not found" });
    // PS: "Live location sharing is enabled only while a trip is active."
    if (!["STARTED", "IN_PROGRESS"].includes(ride.status)) {
      return res.status(409).json({ error: "Tracking is only active during a trip" });
    }

    await prisma.locationPing.create({
      data: { rideId: ride.id, lat, lng, speedKmph, heading, accuracyM },
    });
    res.status(201).json({ ok: true });
  })
);

router.get(
  "/:id/track",
  ah(async (req, res) => {
    const ride = await prisma.ride.findFirst({
      where: { id: req.params.id, orgId: req.user.orgId },
      include: { bookings: { select: { passengerId: true } } },
    });
    if (!ride) return res.status(404).json({ error: "Ride not found" });

    // Only the driver and booked passengers may watch a vehicle move.
    const isParticipant =
      ride.driverId === req.user.id || ride.bookings.some((b) => b.passengerId === req.user.id);
    if (!isParticipant) return res.status(403).json({ error: "Not a participant on this trip" });

    const last = await prisma.locationPing.findFirst({
      where: { rideId: ride.id },
      orderBy: { recordedAt: "desc" },
    });

    const live = last ? liveProgress(ride, last) : {};

    res.json({
      status: ride.status,
      position: last && {
        lat: last.lat,
        lng: last.lng,
        at: last.recordedAt,
        speedKmph: last.speedKmph,
        heading: last.heading,
        accuracyM: last.accuracyM,
      },
      ...live,
      destination: { lat: ride.destLat, lng: ride.destLng, label: ride.destLabel },
      origin: { lat: ride.originLat, lng: ride.originLng, label: ride.originLabel },
      routeGeometry: ride.routeGeometry,
    });
  })
);

// --------------------------------------------------------- route optimisation
// The driver's pickup running order. Booking order is not travel order, and on
// a 3-passenger ride the difference is routinely several kilometres.
router.get(
  "/:id/plan",
  ah(async (req, res) => {
    const ride = await prisma.ride.findFirst({
      where: { id: req.params.id, driverId: req.user.id },
      include: {
        bookings: {
          where: { status: { not: "CANCELLED" } },
          include: { passenger: { select: { id: true, name: true, phone: true, avatarColor: true } } },
        },
      },
    });
    if (!ride) return res.status(404).json({ error: "Ride not found or you are not the driver" });

    const origin = { lat: ride.originLat, lng: ride.originLng };
    const dest = { lat: ride.destLat, lng: ride.destLng };

    const stops = ride.bookings.map((b) => ({
      bookingId: b.id,
      label: b.pickupLabel,
      lat: b.pickupLat,
      lng: b.pickupLng,
      passenger: b.passenger,
      seats: b.seats,
    }));

    const { order, distanceKm } = planPickups(origin, dest, stops);
    const naiveKm = bookingOrderDistance(origin, stops, dest);

    res.json({
      stops: order.map((s, i) => ({ ...s, sequence: i + 1 })),
      optimisedKm: distanceKm,
      bookingOrderKm: round2(naiveKm),
      savedKm: round2(Math.max(0, naiveKm - distanceKm)),
    });
  })
);

// ------------------------------------------------------------ recurring rides
// Materialises the next occurrences of a weekly commute. Rides are real rows,
// not a recurrence rule evaluated at read time, so seats and bookings work
// exactly as they do for a one-off ride.
router.post(
  "/:id/repeat",
  ah(async (req, res) => {
    const weeks = Math.min(Math.max(Number(req.body?.weeks) || 1, 1), 4);

    const template = await prisma.ride.findFirst({
      where: { id: req.params.id, driverId: req.user.id },
    });
    if (!template) return res.status(404).json({ error: "Ride not found" });
    if (!template.isRecurring || template.recurrenceDays.length === 0) {
      return res.status(400).json({ error: "This ride is not set to repeat" });
    }

    const base = new Date(template.departureAt);
    const wanted = [];

    for (let week = 0; week < weeks; week++) {
      for (const day of template.recurrenceDays) {
        const d = new Date(base);
        // Advance to the next matching weekday, then step forward by week.
        const delta = (day - base.getDay() + 7) % 7;
        d.setDate(base.getDate() + delta + week * 7);
        if (d > base) wanted.push(d);
      }
    }

    // Skip occurrences that already exist so repeated calls stay idempotent.
    const existing = await prisma.ride.findMany({
      where: {
        driverId: req.user.id,
        originLat: template.originLat,
        destLat: template.destLat,
        departureAt: { in: wanted },
      },
      select: { departureAt: true },
    });
    const taken = new Set(existing.map((r) => r.departureAt.getTime()));
    const toCreate = wanted.filter((d) => !taken.has(d.getTime()));

    await prisma.ride.createMany({
      data: toCreate.map((departureAt) => ({
        orgId: template.orgId,
        driverId: template.driverId,
        vehicleId: template.vehicleId,
        originLabel: template.originLabel,
        originLat: template.originLat,
        originLng: template.originLng,
        destLabel: template.destLabel,
        destLat: template.destLat,
        destLng: template.destLng,
        departureAt,
        totalSeats: template.totalSeats,
        seatsLeft: template.totalSeats,
        farePerSeat: template.farePerSeat,
        distanceKm: template.distanceKm,
        durationMin: template.durationMin,
        routeGeometry: template.routeGeometry,
        isRecurring: false, // occurrences are concrete rides, not templates
      })),
    });

    res.status(201).json({ created: toCreate.length, skipped: wanted.length - toCreate.length });
  })
);

// ------------------------------------------------------- shareable live link
// Any participant can mint one. The token is per-ride and the public endpoint
// stops returning a position once the trip ends.
router.post(
  "/:id/share",
  ah(async (req, res) => {
    const ride = await prisma.ride.findFirst({
      where: { id: req.params.id, orgId: req.user.orgId },
      include: { bookings: { select: { passengerId: true, status: true } } },
    });
    if (!ride) return res.status(404).json({ error: "Ride not found" });

    const isParticipant =
      ride.driverId === req.user.id ||
      ride.bookings.some((b) => b.passengerId === req.user.id && b.status !== "CANCELLED");
    if (!isParticipant) return res.status(403).json({ error: "Not a participant on this trip" });

    const shareToken = ride.shareToken ?? randomBytes(9).toString("base64url");
    if (!ride.shareToken) {
      await prisma.ride.update({ where: { id: ride.id }, data: { shareToken } });
    }

    res.json({ shareToken });
  })
);

// -------------------------------------------------------------------- chat
/**
 * Chat is private to the people actually travelling together.
 *
 * Org membership is not enough: a colleague who is not on the trip has no
 * business reading where someone is being collected from.
 */
async function assertParticipant(req) {
  const ride = await prisma.ride.findFirst({
    where: { id: req.params.id, orgId: req.user.orgId },
    select: {
      driverId: true,
      bookings: { where: { status: { not: "CANCELLED" } }, select: { passengerId: true } },
    },
  });
  if (!ride) return { error: 404, message: "Ride not found" };

  const isParticipant =
    ride.driverId === req.user.id || ride.bookings.some((b) => b.passengerId === req.user.id);
  if (!isParticipant) return { error: 403, message: "Not a participant on this trip" };

  return { ok: true };
}

router.get(
  "/:id/messages",
  ah(async (req, res) => {
    const guard = await assertParticipant(req);
    if (guard.error) return res.status(guard.error).json({ error: guard.message });

    const messages = await prisma.message.findMany({
      where: { rideId: req.params.id },
      include: { sender: { select: { id: true, name: true, avatarColor: true } } },
      orderBy: { createdAt: "asc" },
      take: 200,
    });
    res.json({ messages });
  })
);

router.post(
  "/:id/messages",
  ah(async (req, res) => {
    const guard = await assertParticipant(req);
    if (guard.error) return res.status(guard.error).json({ error: guard.message });

    const body = String(req.body?.body ?? "").trim();
    if (!body) return res.status(400).json({ error: "Message cannot be empty" });

    const message = await prisma.message.create({
      data: { rideId: req.params.id, senderId: req.user.id, body },
      include: { sender: { select: { id: true, name: true, avatarColor: true } } },
    });
    res.status(201).json({ message });
  })
);

// ------------------------------------------------------------------ shaping
const rideInclude = {
  driver: { select: { id: true, name: true, phone: true, avatarColor: true, department: true } },
  vehicle: { select: { id: true, model: true, registrationNumber: true, seatingCapacity: true } },
  bookings: {
    where: { status: { not: "CANCELLED" } },
    include: { passenger: { select: { id: true, name: true, phone: true, avatarColor: true } } },
  },
};

// Prisma returns Decimal objects; the client wants plain numbers.
function shapeRide(r) {
  return {
    ...r,
    farePerSeat: Number(r.farePerSeat),
    distanceKm: Number(r.distanceKm),
    bookings: r.bookings?.map((b) => ({ ...b, fareAmount: Number(b.fareAmount) })),
  };
}

const round1 = (n) => Math.round(n * 10) / 10;
const round2 = (n) => Math.round(n * 100) / 100;

/**
 * How far along a trip is, from its most recent GPS fix.
 *
 * The ETA blends the vehicle's reported speed with a city average rather than
 * trusting either alone. Reported speed on its own is worse than useless at a
 * red light — it reads zero and the ETA becomes infinite — while a fixed
 * average ignores a car that is genuinely stuck. Below walking pace the
 * average wins; above it, the two are averaged so a fast run shortens the
 * estimate without a momentary burst throwing it.
 *
 * Progress is measured against straight-line distances, so it is approximate
 * by construction. It is used to draw a bar, not to bill anyone.
 */
function liveProgress(ride, last) {
  const CITY_AVERAGE_KMPH = 28;

  const remainingKm = haversineKm(last.lat, last.lng, ride.destLat, ride.destLng);
  const totalKm = haversineKm(ride.originLat, ride.originLng, ride.destLat, ride.destLng);

  const reported = Number(last.speedKmph) || 0;
  const effectiveKmph =
    reported > 5 ? (reported + CITY_AVERAGE_KMPH) / 2 : CITY_AVERAGE_KMPH;

  return {
    etaMinutes: Math.max(1, Math.round((remainingKm / effectiveKmph) * 60)),
    remainingKm: round1(remainingKm),
    // Clamped: a driver who overshoots or starts early would otherwise produce
    // a bar that is negative or past its own end.
    progressPercent: totalKm > 0
      ? Math.min(100, Math.max(0, Math.round((1 - remainingKm / totalKm) * 100)))
      : 0,
    // How stale the fix is. The client shows this rather than implying a
    // marker that has not moved in five minutes is a car that is not moving.
    fixAgeSeconds: Math.max(0, Math.round((Date.now() - last.recordedAt.getTime()) / 1000)),
  };
}

export default router;
