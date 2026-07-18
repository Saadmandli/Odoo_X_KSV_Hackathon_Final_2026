import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { requireAuth, ah } from "../middleware/auth.js";

const router = Router();
router.use(requireAuth);

const rateSchema = z.object({
  rideId: z.string(),
  stars: z.number().int().min(1).max(5),
  comment: z.string().max(300).optional(),
});

router.post(
  "/",
  ah(async (req, res) => {
    const parsed = rateSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Choose a rating from 1 to 5" });
    const { rideId, stars, comment } = parsed.data;

    // Only someone who actually completed the trip may rate it.
    const booking = await prisma.booking.findFirst({
      where: { rideId, passengerId: req.user.id, status: { not: "CANCELLED" } },
      include: { ride: true },
    });
    if (!booking) return res.status(403).json({ error: "You did not travel on this ride" });
    if (booking.ride.status !== "COMPLETED") {
      return res.status(409).json({ error: "You can rate once the trip is complete" });
    }

    const rating = await prisma.rating.upsert({
      where: { rideId_raterId: { rideId, raterId: req.user.id } },
      create: { rideId, raterId: req.user.id, driverId: booking.ride.driverId, stars, comment },
      update: { stars, comment },
    });

    res.status(201).json({ rating });
  })
);

/** A driver's average and count, used on ride cards and profiles. */
router.get(
  "/driver/:driverId",
  ah(async (req, res) => {
    const driver = await prisma.user.findFirst({
      where: { id: req.params.driverId, orgId: req.user.orgId },
      select: { id: true },
    });
    if (!driver) return res.status(404).json({ error: "Driver not found" });

    const agg = await prisma.rating.aggregate({
      where: { driverId: driver.id },
      _avg: { stars: true },
      _count: true,
    });

    res.json({
      average: agg._avg.stars ? Math.round(agg._avg.stars * 10) / 10 : null,
      count: agg._count,
    });
  })
);

/** What the current user already submitted for a ride, so the UI can prefill. */
router.get(
  "/mine/:rideId",
  ah(async (req, res) => {
    const rating = await prisma.rating.findUnique({
      where: { rideId_raterId: { rideId: req.params.rideId, raterId: req.user.id } },
    });
    res.json({ rating });
  })
);

export default router;
