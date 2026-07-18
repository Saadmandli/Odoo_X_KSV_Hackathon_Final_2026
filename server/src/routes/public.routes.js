import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { ah } from "../middleware/auth.js";
import { haversineKm } from "../lib/geo.js";

// Unauthenticated by design: a rider shares this link with family so they can
// watch the journey. It is therefore the only route in the app that is not
// org-scoped, and it must leak as little as possible.
const router = Router();

/**
 * Which organisation a given email domain belongs to.
 *
 * Used on the sign-up screen so someone can see the company they are about to
 * join before submitting. Returns the name only — never the employee list,
 * settings or anything else — so it cannot be used to survey an organisation.
 */
router.get(
  "/organization",
  ah(async (req, res) => {
    const domain = String(req.query.domain ?? "").trim().toLowerCase();
    if (!domain) return res.status(400).json({ error: "Domain is required" });

    const org = await prisma.organization.findUnique({
      where: { domain },
      select: { name: true, domain: true },
    });

    if (!org) {
      return res.status(404).json({
        error: `${domain} is not a registered organisation.`,
        registered: false,
      });
    }

    res.json({ registered: true, ...org });
  })
);

router.get(
  "/track/:token",
  ah(async (req, res) => {
    const ride = await prisma.ride.findUnique({
      where: { shareToken: req.params.token },
      select: {
        id: true,
        status: true,
        originLabel: true,
        destLabel: true,
        destLat: true,
        destLng: true,
        originLat: true,
        originLng: true,
        routeGeometry: true,
        departureAt: true,
        driver: { select: { name: true } },
        vehicle: { select: { model: true, registrationNumber: true } },
      },
    });

    if (!ride) return res.status(404).json({ error: "This tracking link is not valid." });

    // The link stops working once the journey ends, so a shared URL can't be
    // used to follow someone indefinitely.
    if (!["STARTED", "IN_PROGRESS"].includes(ride.status)) {
      return res.json({
        active: false,
        status: ride.status,
        from: ride.originLabel,
        to: ride.destLabel,
        driverName: firstName(ride.driver.name),
      });
    }

    const last = await prisma.locationPing.findFirst({
      where: { rideId: ride.id },
      orderBy: { recordedAt: "desc" },
    });

    let etaMinutes = null;
    if (last) {
      const remainingKm = haversineKm(last.lat, last.lng, ride.destLat, ride.destLng);
      etaMinutes = Math.max(1, Math.round((remainingKm / 28) * 60));
    }

    res.json({
      active: true,
      status: ride.status,
      from: ride.originLabel,
      to: ride.destLabel,
      // First name and plate only: enough to identify the vehicle, no contact
      // details, no email, no organisation.
      driverName: firstName(ride.driver.name),
      vehicle: `${ride.vehicle.model} · ${ride.vehicle.registrationNumber}`,
      position: last && { lat: last.lat, lng: last.lng, at: last.recordedAt },
      etaMinutes,
      origin: { lat: ride.originLat, lng: ride.originLng },
      destination: { lat: ride.destLat, lng: ride.destLng },
      routeGeometry: ride.routeGeometry,
    });
  })
);

const firstName = (n) => String(n).split(" ")[0];

export default router;
