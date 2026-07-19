import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { requireAuth, isAdminRole, ah } from "../middleware/auth.js";

const router = Router();
router.use(requireAuth);

/**
 * The organisation noticeboard.
 *
 * Scoped to req.user.orgId like everything else, so one company never sees
 * another's messages. This is where someone asks for a lift before a ride
 * exists; per-trip chat lives on the ride itself.
 */
router.get(
  "/",
  ah(async (req, res) => {
    // `since` lets the client poll for new messages without refetching the
    // whole history each time.
    const since = req.query.since ? new Date(req.query.since) : null;

    const messages = await prisma.orgMessage.findMany({
      where: {
        orgId: req.user.orgId,
        ...(since && !Number.isNaN(since.getTime()) ? { createdAt: { gt: since } } : {}),
      },
      include: {
        sender: { select: { id: true, name: true, avatarColor: true, department: true } },
      },
      orderBy: { createdAt: "asc" },
      take: 200,
    });

    res.json({ messages });
  })
);

router.post(
  "/",
  ah(async (req, res) => {
    const parsed = z
      .object({ body: z.string().trim().min(1, "Message cannot be empty").max(1000) })
      .safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });

    const message = await prisma.orgMessage.create({
      data: { orgId: req.user.orgId, senderId: req.user.id, body: parsed.data.body },
      include: {
        sender: { select: { id: true, name: true, avatarColor: true, department: true } },
      },
    });

    res.status(201).json({ message });
  })
);

/** Authors can remove their own messages; nobody can remove anyone else's. */
router.delete(
  "/:id",
  ah(async (req, res) => {
    const message = await prisma.orgMessage.findFirst({
      where: { id: req.params.id, orgId: req.user.orgId },
    });
    if (!message) return res.status(404).json({ error: "Message not found" });

    const isAuthor = message.senderId === req.user.id;
    if (!isAuthor && !isAdminRole(req.user.role)) {
      return res.status(403).json({ error: "You can only delete your own messages" });
    }

    await prisma.orgMessage.delete({ where: { id: message.id } });
    res.json({ ok: true });
  })
);

export default router;
