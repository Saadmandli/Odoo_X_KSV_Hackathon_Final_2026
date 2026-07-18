import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { requireAuth, ah } from "../middleware/auth.js";

const router = Router();
router.use(requireAuth);

const point = z.object({ label: z.string().min(1), lat: z.number(), lng: z.number() });
const bookSchema = z.object({
  rideId: z.string(),
  seats: z.number().int().min(1).max(8),
  pickup: point,
  drop: point,
});

router.post(
  "/",
  ah(async (req, res) => {
    const parsed = bookSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });
    const { rideId, seats, pickup, drop } = parsed.data;

    // A transaction with a conditional decrement: two passengers clicking
    // "Book Now" on the last seat at the same time must not both succeed.
    try {
      const booking = await prisma.$transaction(async (tx) => {
        const ride = await tx.ride.findFirst({
          where: { id: rideId, orgId: req.user.orgId },
        });
        if (!ride) throw new HttpError(404, "Ride not found");
        if (ride.driverId === req.user.id) throw new HttpError(400, "You cannot book your own ride");
        if (ride.status !== "PUBLISHED") throw new HttpError(409, "This ride is no longer open for booking");
        // Checked inside the transaction, alongside the seat claim: a ride can
        // depart between reading it and decrementing seats.
        if (ride.departureAt.getTime() < Date.now()) {
          throw new HttpError(409, "This ride has already departed");
        }

        const claimed = await tx.ride.updateMany({
          where: { id: rideId, seatsLeft: { gte: seats } },
          data: { seatsLeft: { decrement: seats } },
        });
        if (claimed.count === 0) throw new HttpError(409, "Not enough seats left");

        // A previous cancellation leaves a row behind, and (rideId, passengerId)
        // is unique — so changing your mind twice would otherwise be blocked
        // forever. Revive the cancelled booking instead of creating a second.
        const previous = await tx.booking.findUnique({
          where: { rideId_passengerId: { rideId, passengerId: req.user.id } },
        });

        if (previous) {
          if (previous.status !== "CANCELLED") {
            throw new HttpError(409, "You have already booked this ride");
          }

          return tx.booking.update({
            where: { id: previous.id },
            data: {
              status: "BOOKED",
              seats,
              fareAmount: Number(ride.farePerSeat) * seats,
              pickupLabel: pickup.label,
              pickupLat: pickup.lat,
              pickupLng: pickup.lng,
              dropLabel: drop.label,
              dropLat: drop.lat,
              dropLng: drop.lng,
            },
            include: bookingInclude,
          });
        }

        return tx.booking.create({
          data: {
            rideId,
            passengerId: req.user.id,
            seats,
            fareAmount: Number(ride.farePerSeat) * seats,
            pickupLabel: pickup.label,
            pickupLat: pickup.lat,
            pickupLng: pickup.lng,
            dropLabel: drop.label,
            dropLat: drop.lat,
            dropLng: drop.lng,
          },
          include: bookingInclude,
        });
      });

      await prisma.notification.create({
        data: {
          userId: booking.ride.driverId,
          title: "New booking",
          body: `${req.user.name} booked ${seats} seat(s) on your ride to ${booking.ride.destLabel}.`,
        },
      });

      res.status(201).json({ booking: shapeBooking(booking) });
    } catch (err) {
      if (err instanceof HttpError) return res.status(err.status).json({ error: err.message });
      // Unique constraint on (rideId, passengerId).
      if (err.code === "P2002") {
        return res.status(409).json({ error: "You have already booked this ride" });
      }
      throw err;
    }
  })
);

// My Trips — active bookings plus rides the user is driving.
router.get(
  "/my-trips",
  ah(async (req, res) => {
    const [asPassenger, asDriver] = await Promise.all([
      prisma.booking.findMany({
        where: { passengerId: req.user.id, status: { in: ["BOOKED", "COMPLETED"] } },
        include: bookingInclude,
        orderBy: { createdAt: "desc" },
      }),
      prisma.ride.findMany({
        where: { driverId: req.user.id, status: { notIn: ["CANCELLED"] } },
        include: {
          vehicle: true,
          bookings: {
            where: { status: { not: "CANCELLED" } },
            include: { passenger: { select: { id: true, name: true, phone: true, avatarColor: true } }, payment: true },
          },
        },
        orderBy: { departureAt: "desc" },
      }),
    ]);

    res.json({
      asPassenger: asPassenger.map(shapeBooking),
      asDriver: asDriver.map((r) => ({
        ...r,
        farePerSeat: Number(r.farePerSeat),
        distanceKm: Number(r.distanceKm),
        bookings: r.bookings.map((b) => ({ ...b, fareAmount: Number(b.fareAmount) })),
      })),
    });
  })
);

// Ride History — completed journeys only, both roles.
router.get(
  "/history",
  ah(async (req, res) => {
    const [asPassenger, asDriver] = await Promise.all([
      prisma.booking.findMany({
        where: { passengerId: req.user.id, ride: { status: "COMPLETED" } },
        include: bookingInclude,
        orderBy: { createdAt: "desc" },
      }),
      prisma.ride.findMany({
        where: { driverId: req.user.id, status: "COMPLETED" },
        include: {
          vehicle: true,
          bookings: { include: { passenger: { select: { id: true, name: true, avatarColor: true } } } },
        },
        orderBy: { completedAt: "desc" },
      }),
    ]);

    res.json({
      asPassenger: asPassenger.map(shapeBooking),
      asDriver: asDriver.map((r) => ({ ...r, farePerSeat: Number(r.farePerSeat), distanceKm: Number(r.distanceKm) })),
    });
  })
);

router.post(
  "/:id/cancel",
  ah(async (req, res) => {
    const booking = await prisma.booking.findFirst({
      where: { id: req.params.id, passengerId: req.user.id },
      include: { ride: true },
    });
    if (!booking) return res.status(404).json({ error: "Booking not found" });
    if (booking.status !== "BOOKED") {
      return res.status(400).json({ error: `Booking is already ${booking.status.toLowerCase()}` });
    }
    if (booking.ride.status !== "PUBLISHED") {
      return res.status(409).json({ error: "The trip has already started" });
    }

    // Returning the seats is the whole point — do it atomically with the cancel.
    await prisma.$transaction([
      prisma.booking.update({ where: { id: booking.id }, data: { status: "CANCELLED" } }),
      prisma.ride.update({
        where: { id: booking.rideId },
        data: { seatsLeft: { increment: booking.seats } },
      }),
      prisma.notification.create({
        data: {
          userId: booking.ride.driverId,
          title: "Booking cancelled",
          body: `${req.user.name} cancelled ${booking.seats} seat(s).`,
        },
      }),
    ]);

    res.json({ ok: true });
  })
);

const bookingInclude = {
  ride: {
    include: {
      driver: { select: { id: true, name: true, phone: true, avatarColor: true } },
      vehicle: { select: { id: true, model: true, registrationNumber: true } },
    },
  },
  payment: true,
};

function shapeBooking(b) {
  return {
    ...b,
    fareAmount: Number(b.fareAmount),
    ride: b.ride && {
      ...b.ride,
      farePerSeat: Number(b.ride.farePerSeat),
      distanceKm: Number(b.ride.distanceKm),
    },
    payment: b.payment && { ...b.payment, amount: Number(b.payment.amount) },
  };
}

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

export default router;
