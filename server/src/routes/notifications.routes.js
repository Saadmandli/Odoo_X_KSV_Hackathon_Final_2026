import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { requireAuth, ah } from "../middleware/auth.js";

const router = Router();
router.use(requireAuth);

router.get(
  "/",
  ah(async (req, res) => {
    const notifications = await prisma.notification.findMany({
      where: { userId: req.user.id },
      orderBy: { createdAt: "desc" },
      take: 30,
    });
    const unread = notifications.filter((n) => !n.isRead).length;
    res.json({ notifications, unread });
  })
);

router.post(
  "/read",
  ah(async (req, res) => {
    await prisma.notification.updateMany({
      where: { userId: req.user.id, isRead: false },
      data: { isRead: true },
    });
    res.json({ ok: true });
  })
);

export default router;
