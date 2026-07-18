import { Router } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { signToken, requireAuth, ah } from "../middleware/auth.js";

const router = Router();

const AVATAR_COLORS = ["#2563eb", "#7c3aed", "#db2777", "#ea580c", "#059669", "#0891b2"];

const signupSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Enter a valid email"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  phone: z.string().min(8, "Enter a valid phone number").optional(),
  employeeCode: z.string().optional(),
});

// Employees are placed into an org by email domain — this is what makes the
// platform multi-tenant without an invite flow we don't have time to build.
router.post(
  "/signup",
  ah(async (req, res) => {
    const parsed = signupSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });

    const { name, email, password, phone, employeeCode } = parsed.data;
    const domain = email.split("@")[1]?.toLowerCase();

    const org = await prisma.organization.findUnique({ where: { domain } });
    if (!org) {
      return res.status(403).json({
        error: `${domain} is not a registered organization. Contact your administrator.`,
      });
    }

    if (await prisma.user.findUnique({ where: { email } })) {
      return res.status(409).json({ error: "Email already registered" });
    }

    const user = await prisma.user.create({
      data: {
        orgId: org.id,
        name,
        email,
        phone,
        employeeCode,
        passwordHash: await bcrypt.hash(password, 10),
        avatarColor: AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)],
        // Wallet up front so payment code never has to create one lazily.
        wallet: { create: {} },
      },
    });

    res.status(201).json({ token: signToken(user), user: publicUser(user) });
  })
);

router.post(
  "/login",
  ah(async (req, res) => {
    const { email, password } = req.body ?? {};
    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required" });
    }

    const user = await prisma.user.findUnique({ where: { email } });
    // Identical message for "no such user" and "wrong password" so this can't
    // be used to enumerate which employees exist.
    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      return res.status(401).json({ error: "Invalid email or password" });
    }
    if (!user.isActive) return res.status(403).json({ error: "Account deactivated" });

    res.json({ token: signToken(user), user: publicUser(user) });
  })
);

router.get(
  "/me",
  requireAuth,
  ah(async (req, res) => {
    const org = await prisma.organization.findUnique({
      where: { id: req.user.orgId },
      select: { id: true, name: true, currency: true },
    });
    res.json({ user: req.user, org });
  })
);

function publicUser(u) {
  return {
    id: u.id,
    orgId: u.orgId,
    name: u.name,
    email: u.email,
    phone: u.phone,
    role: u.role,
    avatarColor: u.avatarColor,
  };
}

export default router;
