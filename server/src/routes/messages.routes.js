import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { requireAuth, ah } from "../middleware/auth.js";

/**
 * Private one-to-one messages between colleagues.
 *
 * Distinct from the noticeboard (/api/chat), which the whole company reads, and
 * from ride chat, which only exists while a trip does. This is how someone
 * arranges a lift with one specific person without posting it to everyone.
 *
 * Every route resolves the other participant through `sameOrgUser`, so a user
 * id from another company is a 404 rather than a conversation.
 */
const router = Router();
router.use(requireAuth);

const bodySchema = z.object({
  body: z.string().trim().min(1, "Message cannot be empty").max(2000),
});

const PERSON = {
  id: true,
  name: true,
  avatarColor: true,
  department: true,
  role: true,
};

/** The colleague on the other end, or null if they are not someone you may message. */
async function sameOrgUser(req, id) {
  if (id === req.user.id) return null; // no talking to yourself
  return prisma.user.findFirst({
    where: { id, orgId: req.user.orgId, isActive: true, isApproved: true },
    select: PERSON,
  });
}

// ------------------------------------------------------------------ directory
// Everyone you are allowed to start a conversation with.
router.get(
  "/people",
  ah(async (req, res) => {
    const q = String(req.query.q ?? "").trim();

    const people = await prisma.user.findMany({
      where: {
        orgId: req.user.orgId,
        isActive: true,
        isApproved: true,
        id: { not: req.user.id },
        ...(q ? { name: { contains: q, mode: "insensitive" } } : {}),
      },
      select: PERSON,
      orderBy: { name: "asc" },
      take: 100,
    });

    res.json({ people });
  })
);

// -------------------------------------------------------------- conversations
// The inbox: one row per person, showing the last thing either of you said.
router.get(
  "/",
  ah(async (req, res) => {
    const me = req.user.id;

    // Read the whole correspondence once and fold it in memory. An inbox is
    // bounded by how many colleagues someone has actually messaged, so this
    // stays far cheaper than a per-conversation query each time it renders.
    const messages = await prisma.directMessage.findMany({
      where: { orgId: req.user.orgId, OR: [{ senderId: me }, { recipientId: me }] },
      include: { sender: { select: PERSON }, recipient: { select: PERSON } },
      orderBy: { createdAt: "desc" },
      take: 500,
    });

    const threads = new Map();
    for (const m of messages) {
      const other = m.senderId === me ? m.recipient : m.sender;
      let thread = threads.get(other.id);
      if (!thread) {
        // Messages arrive newest first, so the first one seen for a person is
        // the latest and becomes the preview.
        thread = {
          person: other,
          lastMessage: { body: m.body, createdAt: m.createdAt, fromMe: m.senderId === me },
          unread: 0,
        };
        threads.set(other.id, thread);
      }
      if (m.recipientId === me && m.readAt === null) thread.unread += 1;
    }

    res.json({ conversations: [...threads.values()] });
  })
);

// A single number for the sidebar badge.
router.get(
  "/unread-count",
  ah(async (req, res) => {
    const count = await prisma.directMessage.count({
      where: { recipientId: req.user.id, readAt: null },
    });
    res.json({ count });
  })
);

// ---------------------------------------------------------------- one thread
router.get(
  "/:userId",
  ah(async (req, res) => {
    const other = await sameOrgUser(req, req.params.userId);
    if (!other) return res.status(404).json({ error: "Person not found" });

    const me = req.user.id;
    const messages = await prisma.directMessage.findMany({
      where: {
        OR: [
          { senderId: me, recipientId: other.id },
          { senderId: other.id, recipientId: me },
        ],
      },
      orderBy: { createdAt: "asc" },
      take: 500,
    });

    // Opening the thread is what marks it read — done after the read above so
    // the caller still sees which messages were new when they opened it.
    await prisma.directMessage.updateMany({
      where: { senderId: other.id, recipientId: me, readAt: null },
      data: { readAt: new Date() },
    });

    res.json({ person: other, messages });
  })
);

router.post(
  "/:userId",
  ah(async (req, res) => {
    const parsed = bodySchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });

    const other = await sameOrgUser(req, req.params.userId);
    if (!other) return res.status(404).json({ error: "Person not found" });

    const message = await prisma.directMessage.create({
      data: {
        orgId: req.user.orgId,
        senderId: req.user.id,
        recipientId: other.id,
        body: parsed.data.body,
      },
    });

    res.status(201).json({ message });
  })
);

/** Authors can retract their own messages. Nobody can delete what was said to them. */
router.delete(
  "/message/:id",
  ah(async (req, res) => {
    const message = await prisma.directMessage.findFirst({
      where: { id: req.params.id, senderId: req.user.id },
    });
    if (!message) return res.status(404).json({ error: "Message not found" });

    await prisma.directMessage.delete({ where: { id: message.id } });
    res.json({ ok: true });
  })
);

export default router;
