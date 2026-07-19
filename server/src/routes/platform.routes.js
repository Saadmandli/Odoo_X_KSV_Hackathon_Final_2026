import { Router } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import * as V from "../lib/validation.js";
import { requireAuth, requireSuperAdmin, ADMIN_ROLES, ah } from "../middleware/auth.js";

/**
 * The platform console.
 *
 * Every other router in this app is deliberately trapped inside one
 * organisation: it reads req.user.orgId and can never see past it. This one is
 * the exception, and it is the only one, which is why it sits behind its own
 * guard and its own mount point rather than as a branch inside admin routes.
 *
 * It does two things: bring an organisation into existence, and decide who
 * administers it. It cannot read anyone's rides, messages or payments — being
 * able to create a tenant is not the same as being able to look inside it.
 */
const router = Router();
router.use(requireAuth, requireSuperAdmin);

// Reusing the same rule as self-serve registration: a company is identified by
// a domain it actually uses, never by a free mailbox provider.
const PUBLIC_EMAIL_DOMAINS = new Set([
  "gmail.com", "googlemail.com", "yahoo.com", "yahoo.in", "yahoo.co.in",
  "outlook.com", "hotmail.com", "live.com", "msn.com",
  "icloud.com", "me.com", "aol.com", "proton.me", "protonmail.com",
  "rediffmail.com", "zoho.com", "mail.com", "gmx.com", "yandex.com",
]);

const domainSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(3, "Domain is required")
  .max(80)
  .regex(/^[a-z0-9.-]+\.[a-z]{2,}$/, "Enter a domain like acme.com");

const createOrgSchema = z.object({
  name: V.text(80, "Company name"),
  domain: domainSchema,
  industry: V.optionalText(60),
  registeredAddress: V.optionalText(200),
  // The first administrator is created with the organisation. An organisation
  // nobody can administer is not a useful thing to have made.
  adminName: V.personName,
  adminEmail: V.email,
  adminPassword: z.string().min(6, "Password must be at least 6 characters").max(200),
});

// ------------------------------------------------------------ organisations
router.get(
  "/organizations",
  ah(async (req, res) => {
    const orgs = await prisma.organization.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        domain: true,
        industry: true,
        registeredAddress: true,
        createdAt: true,
        _count: { select: { users: true, rides: true } },
        users: {
          where: { role: { in: ["ADMIN", "SUPER_ADMIN"] }, isActive: true },
          select: { id: true, name: true, email: true, role: true, avatarColor: true },
          orderBy: { createdAt: "asc" },
        },
      },
    });

    res.json({
      organizations: orgs.map(({ _count, users, ...o }) => ({
        ...o,
        employees: _count.users,
        rides: _count.rides,
        admins: users,
      })),
    });
  })
);

router.post(
  "/organizations",
  ah(async (req, res) => {
    const parsed = createOrgSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });

    const { name, domain, industry, registeredAddress, adminName, adminEmail, adminPassword } =
      parsed.data;

    if (PUBLIC_EMAIL_DOMAINS.has(domain)) {
      return res.status(400).json({ error: `${domain} is a personal email provider, not a company.` });
    }

    // The administrator has to live at the domain they are being put in charge
    // of, for the same reason employees do: the domain is what decides
    // membership, so an admin outside it would be unreachable by that rule.
    const adminDomain = adminEmail.split("@")[1];
    if (adminDomain !== domain) {
      return res.status(400).json({
        error: `The administrator's address must be @${domain}. This one is @${adminDomain}.`,
      });
    }

    if (await prisma.organization.findUnique({ where: { domain } })) {
      return res.status(409).json({ error: `${domain} is already registered.` });
    }
    if (await prisma.user.findUnique({ where: { email: adminEmail } })) {
      return res.status(409).json({ error: "That administrator email is already registered." });
    }

    try {
      const created = await prisma.$transaction(async (tx) => {
        const org = await tx.organization.create({
          data: { name, domain, industry, registeredAddress, adminContact: adminEmail },
        });

        const admin = await tx.user.create({
          data: {
            orgId: org.id,
            name: adminName,
            email: adminEmail,
            role: "ADMIN",
            passwordHash: await bcrypt.hash(adminPassword, 10),
            wallet: { create: {} },
          },
          select: { id: true, name: true, email: true, role: true, avatarColor: true },
        });

        return { org, admin };
      });

      res.status(201).json({
        organization: {
          ...created.org,
          employees: 1,
          rides: 0,
          admins: [created.admin],
        },
      });
    } catch (err) {
      if (err.code === "P2002") {
        return res.status(409).json({ error: `${domain} was just registered by someone else.` });
      }
      throw err;
    }
  })
);

// ------------------------------------------------------------- appoint admins
// Promotes someone who already works there. Deliberately not "create a user":
// an administrator should be a person the organisation already has, and
// creating staff is the org admin's own job.
router.post(
  "/organizations/:id/admins",
  ah(async (req, res) => {
    const parsed = z.object({ userId: z.string().min(1, "Choose an employee") }).safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });

    const org = await prisma.organization.findUnique({ where: { id: req.params.id } });
    if (!org) return res.status(404).json({ error: "Organisation not found" });

    const target = await prisma.user.findFirst({
      where: { id: parsed.data.userId, orgId: org.id },
    });
    if (!target) return res.status(404).json({ error: "That person is not in this organisation" });
    if (target.role === "SUPER_ADMIN") {
      return res.status(400).json({ error: "The platform owner's role cannot be changed here" });
    }

    const updated = await prisma.user.update({
      where: { id: target.id },
      data: { role: "ADMIN", isApproved: true },
      select: { id: true, name: true, email: true, role: true, avatarColor: true },
    });
    res.json({ admin: updated });
  })
);

router.delete(
  "/organizations/:id/admins/:userId",
  ah(async (req, res) => {
    const target = await prisma.user.findFirst({
      where: { id: req.params.userId, orgId: req.params.id },
    });
    if (!target) return res.status(404).json({ error: "That person is not in this organisation" });
    if (target.role === "SUPER_ADMIN") {
      return res.status(400).json({ error: "The platform owner cannot be demoted" });
    }

    // An organisation with no administrator cannot approve staff, manage
    // vehicles or answer an SOS, so the last one is not allowed to be removed.
    // Counts the owner too: an organisation the platform owner administers
    // still has someone in charge, so stepping its other admin down is safe.
    const admins = await prisma.user.count({
      where: { orgId: req.params.id, role: { in: ADMIN_ROLES }, isActive: true },
    });
    if (admins <= 1) {
      return res.status(400).json({
        error: "This is the only administrator. Appoint another one before removing this one.",
      });
    }

    const updated = await prisma.user.update({
      where: { id: target.id },
      data: { role: "EMPLOYEE" },
      select: { id: true, name: true, role: true },
    });
    res.json({ employee: updated });
  })
);

/** Everyone in one organisation, so the console can pick an admin from them. */
router.get(
  "/organizations/:id/people",
  ah(async (req, res) => {
    const people = await prisma.user.findMany({
      where: { orgId: req.params.id, isActive: true },
      select: { id: true, name: true, email: true, role: true, avatarColor: true },
      orderBy: [{ role: "asc" }, { name: "asc" }],
      take: 200,
    });
    res.json({ people });
  })
);

export default router;
