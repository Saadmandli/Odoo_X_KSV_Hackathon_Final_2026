import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { requireAuth, ah } from "../middleware/auth.js";

const router = Router();
router.use(requireAuth);

const vehicleSchema = z.object({
  model: z.string().min(2, "Vehicle model is required"),
  registrationNumber: z.string().min(4, "Registration number is required"),
  seatingCapacity: z.number().int().min(1).max(8),
  fuelType: z.string().optional(),
  mileageKmpl: z.number().min(1).max(60).optional(),
  color: z.string().optional(),
});

router.get(
  "/",
  ah(async (req, res) => {
    const vehicles = await prisma.vehicle.findMany({
      where: { userId: req.user.id, isActive: true },
      orderBy: { createdAt: "asc" },
    });
    res.json({ vehicles: vehicles.map(shape) });
  })
);

router.post(
  "/",
  ah(async (req, res) => {
    const parsed = vehicleSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });

    const registrationNumber = parsed.data.registrationNumber.toUpperCase().replace(/\s+/g, "");
    const existing = await prisma.vehicle.findFirst({
      where: { userId: req.user.id, registrationNumber },
    });
    if (existing) return res.status(409).json({ error: "You have already registered this vehicle" });

    const vehicle = await prisma.vehicle.create({
      data: { ...parsed.data, registrationNumber, userId: req.user.id },
    });
    res.status(201).json({ vehicle: shape(vehicle) });
  })
);

router.put(
  "/:id",
  ah(async (req, res) => {
    const parsed = vehicleSchema.partial().safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });

    const owned = await prisma.vehicle.findFirst({
      where: { id: req.params.id, userId: req.user.id },
    });
    if (!owned) return res.status(404).json({ error: "Vehicle not found" });

    const vehicle = await prisma.vehicle.update({ where: { id: owned.id }, data: parsed.data });
    res.json({ vehicle: shape(vehicle) });
  })
);

// Soft delete: rides reference this vehicle and history must survive.
router.delete(
  "/:id",
  ah(async (req, res) => {
    const owned = await prisma.vehicle.findFirst({
      where: { id: req.params.id, userId: req.user.id },
    });
    if (!owned) return res.status(404).json({ error: "Vehicle not found" });

    const activeRides = await prisma.ride.count({
      where: { vehicleId: owned.id, status: { in: ["PUBLISHED", "STARTED", "IN_PROGRESS"] } },
    });
    if (activeRides > 0) {
      return res.status(409).json({ error: "This vehicle has active rides" });
    }

    await prisma.vehicle.update({ where: { id: owned.id }, data: { isActive: false } });
    res.json({ ok: true });
  })
);

const shape = (v) => ({ ...v, mileageKmpl: Number(v.mileageKmpl) });

export default router;
