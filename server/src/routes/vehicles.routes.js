import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import * as V from "../lib/validation.js";
import { requireAuth, ah } from "../middleware/auth.js";

const router = Router();
router.use(requireAuth);

// Constrained to the fuels the fare maths knows about. A free-string fuel type
// reads fine on screen and then silently fails to match anything downstream.
const FUEL_TYPES = ["Petrol", "Diesel", "CNG", "Electric", "Hybrid"];

const vehicleSchema = z.object({
  model: V.text(40, "Vehicle model"),
  registrationNumber: V.registrationNumber,
  seatingCapacity: z
    .number()
    .int("Seats must be a whole number")
    .min(1, "A vehicle needs at least one seat")
    .max(8, "A vehicle cannot have more than 8 seats"),
  fuelType: z.enum(FUEL_TYPES).optional(),
  mileageKmpl: z
    .number()
    .min(1, "Mileage must be at least 1 km/l")
    .max(60, "Mileage above 60 km/l is not realistic")
    .optional(),
  color: V.optionalText(20),
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

    // Already uppercased and stripped by the validator.
    const { registrationNumber } = parsed.data;
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
