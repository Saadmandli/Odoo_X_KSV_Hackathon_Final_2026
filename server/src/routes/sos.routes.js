import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { requireAuth, requireAdmin, ah } from "../middleware/auth.js";

const router = Router();
router.use(requireAuth);

const raiseSchema = z.object({
  rideId: z.string().optional(),
  // Sent when the browser could get a fix. Optional because the alert must go
  // out even if location is denied or unavailable — a refused permission is
  // not a reason to swallow someone's emergency.
  lat: z.number().min(-90).max(90).optional(),
  lng: z.number().min(-180).max(180).optional(),
  note: z.string().max(300).optional(),
});

/**
 * Raise an alert.
 *
 * Everything happens in one transaction so an alert can never exist without
 * having notified anyone, and nobody can be notified about an alert that was
 * not recorded.
 */
router.post(
  "/",
  ah(async (req, res) => {
    const parsed = raiseSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });
    const { rideId, lat, lng, note } = parsed.data;

    // A ride id is accepted only if the caller is actually on that trip.
    // Otherwise the alert is still raised, just without a trip attached.
    let ride = null;
    if (rideId) {
      ride = await prisma.ride.findFirst({
        where: {
          id: rideId,
          orgId: req.user.orgId,
          OR: [
            { driverId: req.user.id },
            { bookings: { some: { passengerId: req.user.id, status: { not: "CANCELLED" } } } },
          ],
        },
        include: {
          bookings: { where: { status: { not: "CANCELLED" } }, select: { passengerId: true } },
        },
      });
    }

    const admins = await prisma.user.findMany({
      where: { orgId: req.user.orgId, role: "ADMIN", isActive: true },
      select: { id: true },
    });

    // Everyone on the trip except the person who raised it — they know.
    const companions = ride
      ? [ride.driverId, ...ride.bookings.map((b) => b.passengerId)].filter(
          (id) => id !== req.user.id
        )
      : [];

    const recipients = [...new Set([...admins.map((a) => a.id), ...companions])];

    const where = ride ? ` on the trip to ${ride.destLabel}` : "";
    const position =
      lat != null && lng != null
        ? `Last known position: ${lat.toFixed(5)}, ${lng.toFixed(5)}.`
        : "No location was available from their device.";

    const [alert] = await prisma.$transaction([
      prisma.sosAlert.create({
        data: {
          orgId: req.user.orgId,
          userId: req.user.id,
          rideId: ride?.id ?? null,
          lat: lat ?? null,
          lng: lng ?? null,
          note: note?.trim() || null,
        },
      }),
      prisma.notification.createMany({
        data: recipients.map((userId) => ({
          userId,
          title: `SOS — ${req.user.name} needs help`,
          body: `${req.user.name} raised an emergency alert${where}. ${position}${
            note?.trim() ? ` They said: "${note.trim()}"` : ""
          }`,
        })),
      }),
    ]);

    res.status(201).json({ alert, notified: recipients.length });
  })
);

/** The caller's own alerts, so the button can show one is already open. */
router.get(
  "/mine",
  ah(async (req, res) => {
    const alerts = await prisma.sosAlert.findMany({
      where: { userId: req.user.id },
      orderBy: { createdAt: "desc" },
      take: 10,
    });
    res.json({ alerts });
  })
);

// ------------------------------------------------------------------- admin

const alertInclude = {
  user: {
    select: {
      id: true,
      name: true,
      phone: true,
      email: true,
      department: true,
      avatarColor: true,
      emergencyContactName: true,
      emergencyContactPhone: true,
    },
  },
  ride: {
    select: {
      id: true,
      originLabel: true,
      destLabel: true,
      departureAt: true,
      status: true,
      vehicle: { select: { model: true, registrationNumber: true } },
    },
  },
};

/**
 * The org's alerts, newest first, active ones first.
 *
 * Emergency contact details are included here and nowhere else in the API:
 * this is the one screen where somebody needs to be able to phone a stranger's
 * family, and it is admin-only.
 */
router.get(
  "/",
  requireAdmin,
  ah(async (req, res) => {
    const alerts = await prisma.sosAlert.findMany({
      where: { orgId: req.user.orgId },
      include: alertInclude,
      // ACTIVE sorts before RESOLVED alphabetically, which is the order an
      // administrator wants anyway: anything open, then the history.
      orderBy: [{ status: "asc" }, { createdAt: "desc" }],
      take: 50,
    });

    res.json({
      alerts,
      activeCount: alerts.filter((a) => a.status === "ACTIVE").length,
    });
  })
);

router.post(
  "/:id/resolve",
  requireAdmin,
  ah(async (req, res) => {
    const existing = await prisma.sosAlert.findFirst({
      where: { id: req.params.id, orgId: req.user.orgId },
    });
    if (!existing) return res.status(404).json({ error: "Alert not found" });
    if (existing.status === "RESOLVED") {
      return res.status(409).json({ error: "This alert is already resolved" });
    }

    const alert = await prisma.sosAlert.update({
      where: { id: existing.id },
      data: { status: "RESOLVED", resolvedAt: new Date(), resolvedBy: req.user.name },
      include: alertInclude,
    });

    // Tell the person who raised it that somebody has picked it up.
    await prisma.notification.create({
      data: {
        userId: alert.userId,
        title: "Your SOS was acknowledged",
        body: `${req.user.name} has marked your alert as handled.`,
      },
    });

    res.json({ alert });
  })
);

export default router;
