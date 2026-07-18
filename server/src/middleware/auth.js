import jwt from "jsonwebtoken";
import { prisma } from "../lib/prisma.js";

const SECRET = process.env.JWT_SECRET || "dev-secret-change-me";

export function signToken(user) {
  return jwt.sign({ sub: user.id, orgId: user.orgId, role: user.role }, SECRET, {
    expiresIn: "7d",
  });
}

// Attaches req.user. Every downstream query MUST filter by req.user.orgId —
// that is the whole of our multi-tenant isolation, so it is never optional.
export async function requireAuth(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: "Not authenticated" });

  try {
    const payload = jwt.verify(token, SECRET);
    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      select: {
        id: true,
        orgId: true,
        role: true,
        name: true,
        email: true,
        phone: true,
        avatarColor: true,
        isActive: true,
        isApproved: true,
      },
    });

    // Re-read rather than trusting the token body: an admin can revoke platform
    // access mid-session and that must take effect on the very next request.
    if (!user || !user.isActive) return res.status(401).json({ error: "Account inactive" });
    if (!user.isApproved) {
      return res.status(403).json({ error: "Platform access pending admin approval" });
    }

    req.user = user;
    next();
  } catch {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}

export function requireAdmin(req, res, next) {
  if (req.user?.role !== "ADMIN") {
    return res.status(403).json({ error: "Admin access required" });
  }
  next();
}

/** Wraps an async route so a rejected promise becomes a 500 instead of a hang. */
export const ah = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
