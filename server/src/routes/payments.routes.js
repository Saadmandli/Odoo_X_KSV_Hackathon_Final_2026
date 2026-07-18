import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { requireAuth, ah } from "../middleware/auth.js";
import {
  createOrder,
  isRazorpayConfigured,
  razorpayKeyId,
  verifySignature,
} from "../lib/razorpay.js";

const router = Router();
router.use(requireAuth);

// Lets the client decide whether to open Razorpay checkout or fall back.
router.get("/config", (_req, res) =>
  res.json({ razorpayEnabled: isRazorpayConfigured, keyId: razorpayKeyId })
);

// ------------------------------------------------------------------- wallet
router.get(
  "/wallet",
  ah(async (req, res) => {
    const wallet = await prisma.wallet.upsert({
      where: { userId: req.user.id },
      create: { userId: req.user.id },
      update: {},
      include: { transactions: { orderBy: { createdAt: "desc" }, take: 30 } },
    });

    res.json({
      balance: Number(wallet.balance),
      transactions: wallet.transactions.map((t) => ({ ...t, amount: Number(t.amount) })),
    });
  })
);

const rechargeSchema = z.object({
  amount: z.number().positive().max(50000),
  method: z.enum(["CARD", "UPI"]),
});

// Step 1 of a recharge: ask Razorpay for an order the browser can pay against.
router.post(
  "/wallet/recharge/order",
  ah(async (req, res) => {
    const parsed = rechargeSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Enter a valid amount" });

    const order = await createOrder({
      amountRupees: parsed.data.amount,
      receipt: `wallet_${req.user.id.slice(-8)}_${Date.now()}`,
      notes: { purpose: "wallet_recharge", userId: req.user.id },
    });

    if (!order) {
      return res.json({ sandbox: true, amount: parsed.data.amount });
    }
    res.json({ sandbox: false, orderId: order.id, amount: parsed.data.amount, keyId: razorpayKeyId });
  })
);

// Step 2: credit the wallet, but only after the signature checks out.
router.post(
  "/wallet/recharge/confirm",
  ah(async (req, res) => {
    const parsed = rechargeSchema
      .extend({
        razorpayOrderId: z.string().optional(),
        razorpayPaymentId: z.string().optional(),
        razorpaySignature: z.string().optional(),
      })
      .safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Enter a valid amount" });

    const { amount, method, razorpayOrderId, razorpayPaymentId, razorpaySignature } = parsed.data;

    if (isRazorpayConfigured) {
      const valid = verifySignature({
        orderId: razorpayOrderId,
        paymentId: razorpayPaymentId,
        signature: razorpaySignature,
      });
      if (!valid) return res.status(400).json({ error: "Payment could not be verified" });
    }

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
          description: `Wallet top-up via ${method.toLowerCase()}`,
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
async function loadPayableBooking(userId, bookingId) {
  const booking = await prisma.booking.findFirst({
    where: { id: bookingId, passengerId: userId },
    include: { ride: true, payment: true },
  });

  if (!booking) throw new HttpError(404, "Booking not found");
  if (booking.payment?.status === "COMPLETED") {
    throw new HttpError(409, "This trip is already paid");
  }
  // PS lifecycle: payment opens once the trip is completed.
  if (booking.ride.status !== "COMPLETED") {
    throw new HttpError(409, "Payment opens once the trip is completed");
  }

  return booking;
}

// Card and UPI go through Razorpay; this mints the order.
router.post(
  "/order",
  ah(async (req, res) => {
    try {
      const booking = await loadPayableBooking(req.user.id, req.body?.bookingId);
      const amount = Number(booking.fareAmount);

      const order = await createOrder({
        amountRupees: amount,
        receipt: `ride_${booking.id.slice(-8)}`,
        notes: { bookingId: booking.id, rideId: booking.rideId },
      });

      if (!order) return res.json({ sandbox: true, amount });
      res.json({ sandbox: false, orderId: order.id, amount, keyId: razorpayKeyId });
    } catch (err) {
      if (err instanceof HttpError) return res.status(err.status).json({ error: err.message });
      throw err;
    }
  })
);

const paySchema = z.object({
  bookingId: z.string(),
  method: z.enum(["CASH", "CARD", "UPI", "WALLET"]),
  razorpayOrderId: z.string().optional(),
  razorpayPaymentId: z.string().optional(),
  razorpaySignature: z.string().optional(),
});

router.post(
  "/pay",
  ah(async (req, res) => {
    const parsed = paySchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Choose a payment method" });

    const { bookingId, method, razorpayOrderId, razorpayPaymentId, razorpaySignature } = parsed.data;

    try {
      const booking = await loadPayableBooking(req.user.id, bookingId);
      const amount = Number(booking.fareAmount);

      // Card and UPI must carry a signature we can verify, when keys are set.
      if (["CARD", "UPI"].includes(method) && isRazorpayConfigured) {
        const valid = verifySignature({
          orderId: razorpayOrderId,
          paymentId: razorpayPaymentId,
          signature: razorpaySignature,
        });
        if (!valid) return res.status(400).json({ error: "Payment could not be verified" });
      }

      if (method === "WALLET") {
        const wallet = await prisma.wallet.findUnique({ where: { userId: req.user.id } });
        const balance = Number(wallet?.balance ?? 0);
        if (balance < amount) {
          return res.status(402).json({
            error: `Not enough balance. Add ₹${(amount - balance).toFixed(2)} to your wallet.`,
            shortfall: Number((amount - balance).toFixed(2)),
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

          // Money moves inside the organisation: the driver is paid.
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

          return upsertPayment(tx, booking.id, amount, method, "COMPLETED", {});
        });

        await notifyDriver(booking, req.user.name, amount, method);
        return res.json({ payment: shape(payment) });
      }

      const payment = await upsertPayment(prisma, booking.id, amount, method, "COMPLETED", {
        razorpayOrderId,
        razorpayPaymentId,
      });

      await notifyDriver(booking, req.user.name, amount, method);
      res.json({ payment: shape(payment) });
    } catch (err) {
      if (err instanceof HttpError) return res.status(err.status).json({ error: err.message });
      throw err;
    }
  })
);

function upsertPayment(client, bookingId, amount, method, status, extra) {
  return client.payment.upsert({
    where: { bookingId },
    create: { bookingId, amount, method, status, paidAt: new Date(), ...extra },
    update: { method, status, paidAt: new Date(), ...extra },
  });
}

function notifyDriver(booking, payerName, amount, method) {
  return prisma.notification.create({
    data: {
      userId: booking.ride.driverId,
      title: "Payment received",
      body: `${payerName} paid ₹${amount.toFixed(2)} by ${method.toLowerCase()}.`,
    },
  });
}

const shape = (p) => ({ ...p, amount: Number(p.amount) });

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

export default router;
