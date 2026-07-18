import { Router } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import * as V from "../lib/validation.js";
import { signToken, requireAuth, ah } from "../middleware/auth.js";

const router = Router();

const AVATAR_COLORS = ["#2563eb", "#7c3aed", "#db2777", "#ea580c", "#059669", "#0891b2"];

const GENDERS = ["FEMALE", "MALE", "UNDISCLOSED"];

const signupSchema = z.object({
  name: V.personName,
  email: V.email,
  password: z.string().min(6, "Password must be at least 6 characters").max(200),
  phone: V.phone.optional(),
  employeeCode: V.optionalText(20),
  // Optional at every entry point. Someone who skips it lands on UNDISCLOSED
  // and keeps the whole product except women-only rides.
  gender: z.enum(GENDERS).optional(),
});

// Everything a person is allowed to change about themselves after signup.
// Deliberately narrow: name, email, role, org and approval are not in here, so
// no amount of crafted input can promote an account or move it between orgs.
const profileSchema = z.object({
  // blankable, so clearing a field means "remove this" while still reporting
  // the field's own error message when something invalid is typed.
  phone: V.blankable(V.phone),
  gender: z.enum(GENDERS).optional(),
  emergencyContactName: V.blankable(V.personName),
  emergencyContactPhone: V.blankable(V.phone),
});

// Employees are placed into an org by email domain — this is what makes the
// platform multi-tenant without an invite flow we don't have time to build.
router.post(
  "/signup",
  ah(async (req, res) => {
    const parsed = signupSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });

    const { name, email, password, phone, employeeCode, gender } = parsed.data;
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
        gender: gender ?? "UNDISCLOSED",
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
    if (!email || !password || typeof email !== "string" || typeof password !== "string") {
      return res.status(400).json({ error: "Email and password are required" });
    }

    // Normalised the same way signup stores it. Without this, signing up as
    // "Ravi@acme.com" and signing in as "ravi@acme.com" would look like two
    // different accounts and the second would simply be told the password
    // was wrong.
    const user = await prisma.user.findUnique({
      where: { email: email.trim().toLowerCase() },
    });
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

router.put(
  "/me",
  requireAuth,
  ah(async (req, res) => {
    const parsed = profileSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });

    // The validator has already turned a cleared field into null and left an
    // unmentioned field undefined, so the only thing left to decide here is
    // which keys to send: undefined means "leave it alone", null means "clear
    // it", and Prisma writes null as NULL rather than ignoring it.
    const { phone, gender, emergencyContactName, emergencyContactPhone } = parsed.data;

    const user = await prisma.user.update({
      where: { id: req.user.id },
      data: {
        ...(phone !== undefined && { phone }),
        ...(gender !== undefined && { gender }),
        ...(emergencyContactName !== undefined && { emergencyContactName }),
        ...(emergencyContactPhone !== undefined && { emergencyContactPhone }),
      },
    });

    res.json({ user: publicUser(user) });
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
    gender: u.gender,
    emergencyContactName: u.emergencyContactName,
    emergencyContactPhone: u.emergencyContactPhone,
    avatarColor: u.avatarColor,
  };
}

export default router;
