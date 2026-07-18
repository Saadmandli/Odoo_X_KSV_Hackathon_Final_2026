import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { requireAuth, ah } from "../middleware/auth.js";

const router = Router();
router.use(requireAuth);

// ------------------------------------------------------------------- wallet
router.get(
  "/wallet",
  ah(async (req, res) => {
    const wallet = await prisma.wallet.upsert({
      where: { userId: req.user.id },
      create: { userId: req.user.id },
      update: {},
      include: { transactions: { orderBy: { createdAt: "desc" }, take: 25 } },
    });

    res.json({
      balance: Number(wallet.balance),
      transactions: wallet.transactions.map((t) => ({ ...t, amount: Number(t.amount) })),
    });
  })
);

router.post(
  "/wallet/recharge",
  ah(async (req, res) => {
    const parsed = z
      .object({
        amount: z.number().positive().max(50000),
        method: z.enum(["CARD", "UPI"]),
      })
      .safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Enter a valid recharge amount" });
    const { amount, method } = parsed.data;

    const wallet = await prisma.wallet.upsert({
      where: { userId: req.user.id },
      create: { userId: req.user.id },
      update: {},
    });

    const updated = await prisma.$transaction(async (tx) => {
      await tx.walletTransaction.create({
        data: {
          walletId: wallet.id,
          amount,
          type: "CREDIT",
          description: `Wallet recharge via ${method}`,
        },
      });
      return tx.wallet.update({
        where: { id: wallet.id },
        data: { balance: { increment: amount } },
      });
    });

    res.json({ balance: Number(updated.balance) });
  })
);

// ----------------------------------------------------------------- payments
const paySchema = z.object({
  bookingId: z.string(),
  method: z.enum(["CASH", "CARD", "UPI", "WALLET"]),
});

router.post(
  "/pay",
  ah(async (req, res) => {
    const parsed = paySchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Choose a payment method" });
    const { bookingId, method } = parsed.data;

    const booking = await prisma.booking.findFirst({
      where: { id: bookingId, passengerId: req.user.id },
      include: { ride: true, payment: true },
    });
    if (!booking) return res.status(404).json({ error: "Booking not found" });
    if (booking.payment?.status === "COMPLETED") {
      return res.status(409).json({ error: "This trip is already paid" });
    }
    // PS lifecycle: payment happens after the trip completes.
    if (booking.ride.status !== "COMPLETED") {
      return res.status(409).json({ error: "Payment opens once the trip is completed" });
    }

    const amount = Number(booking.fareAmount);

    if (method === "WALLET") {
      const wallet = await prisma.wallet.findUnique({ where: { userId: req.user.id } });
      if (!wallet || Number(wallet.balance) < amount) {
        return res.status(402).json({
          error: `Insufficient wallet balance. Add ₹${(amount - Number(wallet?.balance ?? 0)).toFixed(2)} to continue.`,
        });
      }

      const payment = await prisma.$transaction(async (tx) => {
        await tx.wallet.update({ where: { id: wallet.id }, data: { balance: { decrement: amount } } });
        await tx.walletTransaction.create({
          data: {
            walletId: wallet.id,
            amount,
            type: "DEBIT",
            description: `Ride to ${booking.ride.destLabel}`,
          },
        });
        // Credit the driver's wallet so money actually moves inside the org.
        const driverWallet = await tx.wallet.upsert({
          where: { userId: booking.ride.driverId },
          create: { userId: booking.ride.driverId },
          update: {},
        });
        await tx.wallet.update({
          where: { id: driverWallet.id },
          data: { balance: { increment: amount } },
        });
        await tx.walletTransaction.create({
          data: {
            walletId: driverWallet.id,
            amount,
            type: "CREDIT",
            description: `Ride fare from ${req.user.name}`,
          },
        });
        return upsertPayment(tx, booking.id, amount, method, "COMPLETED");
      });

      return res.json({ payment: { ...payment, amount: Number(payment.amount) } });
    }

    // CASH is settled in the vehicle; CARD/UPI run through Razorpay test mode
    // when keys are present. Either way the demo never blocks on a third party.
    const payment = await upsertPayment(prisma, booking.id, amount, method, "COMPLETED");

    await prisma.notification.create({
      data: {
        userId: booking.ride.driverId,
        title: "Payment received",
        body: `${req.user.name} paid ₹${amount.toFixed(2)} via ${method.toLowerCase()}.`,
      },
    });

    res.json({ payment: { ...payment, amount: Number(payment.amount) } });
  })
);

function upsertPayment(client, bookingId, amount, method, status) {
  return client.payment.upsert({
    where: { bookingId },
    create: { bookingId, amount, method, status, paidAt: new Date() },
    update: { method, status, paidAt: new Date() },
  });
}

export default router;
