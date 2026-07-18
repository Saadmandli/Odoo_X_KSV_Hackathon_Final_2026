import { Router } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import * as V from "../lib/validation.js";
import { requireAuth, requireAdmin, ah } from "../middleware/auth.js";

const router = Router();
router.use(requireAuth, requireAdmin);

// Admin Dashboard stat cards: Total Employees / Registered Vehicles / Rides This Month.
router.get(
  "/stats",
  ah(async (req, res) => {
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const [totalEmployees, registeredVehicles, ridesThisMonth] = await Promise.all([
      prisma.user.count({ where: { orgId: req.user.orgId, isActive: true } }),
      prisma.vehicle.count({ where: { user: { orgId: req.user.orgId }, isActive: true } }),
      prisma.ride.count({ where: { orgId: req.user.orgId, createdAt: { gte: startOfMonth } } }),
    ]);

    res.json({ totalEmployees, registeredVehicles, ridesThisMonth });
  })
);

// ------------------------------------------------------------- employees tab
router.get(
  "/employees",
  ah(async (req, res) => {
    const employees = await prisma.user.findMany({
      where: { orgId: req.user.orgId },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        department: true,
        officeLocation: true,
        manager: true,
        employeeCode: true,
        role: true,
        isApproved: true,
        isActive: true,
        avatarColor: true,
        _count: { select: { ridesOffered: true, bookings: true, vehicles: true } },
      },
      orderBy: { createdAt: "asc" },
    });
    res.json({ employees });
  })
);

router.post(
  "/employees",
  ah(async (req, res) => {
    const parsed = z
      .object({
        name: V.personName,
        email: V.email,
        password: z.string().min(6, "Password must be at least 6 characters").max(200),
        phone: V.phone.optional(),
        department: V.optionalText(40),
        officeLocation: V.optionalText(60),
        manager: V.optionalText(60),
        employeeCode: V.optionalText(20),
      })
      .safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });

    if (await prisma.user.findUnique({ where: { email: parsed.data.email } })) {
      return res.status(409).json({ error: "Email already registered" });
    }

    const { password, ...rest } = parsed.data;
    const user = await prisma.user.create({
      data: {
        ...rest,
        orgId: req.user.orgId,
        passwordHash: await bcrypt.hash(password, 10),
        wallet: { create: {} },
      },
    });
    res.status(201).json({ employee: { id: user.id, name: user.name, email: user.email } });
  })
);

// The "Platform Access" column — approve or revoke.
router.post(
  "/employees/:id/access",
  ah(async (req, res) => {
    const approve = Boolean(req.body?.approve);

    const target = await prisma.user.findFirst({
      where: { id: req.params.id, orgId: req.user.orgId },
    });
    if (!target) return res.status(404).json({ error: "Employee not found" });
    // Without this an admin can revoke themselves and lock the org out entirely.
    if (target.id === req.user.id) {
      return res.status(400).json({ error: "You cannot change your own access" });
    }

    const updated = await prisma.user.update({
      where: { id: target.id },
      data: { isApproved: approve },
      select: { id: true, isApproved: true },
    });
    res.json({ employee: updated });
  })
);

// ------------------------------------------------------------- vehicles tab
router.get(
  "/vehicles",
  ah(async (req, res) => {
    const vehicles = await prisma.vehicle.findMany({
      where: { user: { orgId: req.user.orgId }, isActive: true },
      include: { user: { select: { id: true, name: true, email: true } } },
      orderBy: { createdAt: "asc" },
    });
    res.json({ vehicles: vehicles.map((v) => ({ ...v, mileageKmpl: Number(v.mileageKmpl) })) });
  })
);

router.post(
  "/vehicles/:id/approval",
  ah(async (req, res) => {
    const approve = Boolean(req.body?.approve);

    const vehicle = await prisma.vehicle.findFirst({
      where: { id: req.params.id, user: { orgId: req.user.orgId } },
    });
    if (!vehicle) return res.status(404).json({ error: "Vehicle not found" });

    const updated = await prisma.vehicle.update({
      where: { id: vehicle.id },
      data: { isApproved: approve },
      select: { id: true, isApproved: true },
    });
    res.json({ vehicle: updated });
  })
);

// ------------------------------------------------------------- settings tab
router.get(
  "/settings",
  ah(async (req, res) => {
    const org = await prisma.organization.findUnique({ where: { id: req.user.orgId } });
    res.json({ org: shapeOrg(org) });
  })
);

router.put(
  "/settings",
  ah(async (req, res) => {
    const parsed = z
      .object({
        name: V.text(80, "Company name").optional(),
        registeredAddress: V.optionalText(200),
        industry: V.optionalText(60),
        // This is the address employees are told to contact, so it has to be
        // an address rather than whatever was typed.
        adminContact: V.blankable(V.email),
        // Upper bounds matter here: these three numbers drive every suggested
        // fare in the product, so a stray zero silently reprices the org.
        fuelPricePerLitre: V.money(1000, "Fuel price").optional(),
        costPerKm: V.money(500, "Cost per km").optional(),
        travelCostPerKm: V.money(500, "Travel cost per km").optional(),
      })
      .safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });

    const org = await prisma.organization.update({
      where: { id: req.user.orgId },
      data: parsed.data,
    });
    res.json({ org: shapeOrg(org) });
  })
);

const shapeOrg = (o) => ({
  ...o,
  fuelPricePerLitre: Number(o.fuelPricePerLitre),
  costPerKm: Number(o.costPerKm),
  travelCostPerKm: Number(o.travelCostPerKm),
});

export default router;
