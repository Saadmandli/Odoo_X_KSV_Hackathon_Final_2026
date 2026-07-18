import crypto from "node:crypto";
import Razorpay from "razorpay";

const KEY_ID = process.env.RAZORPAY_KEY_ID || "";
const KEY_SECRET = process.env.RAZORPAY_KEY_SECRET || "";

/**
 * Razorpay is only wired up when test keys are present.
 *
 * Without keys the app still completes card and UPI payments locally and marks
 * them as sandbox. That is deliberate: a demo must never fail because a third
 * party is unreachable or someone forgot to set an environment variable.
 */
export const isRazorpayConfigured = Boolean(KEY_ID && KEY_SECRET);

const client = isRazorpayConfigured
  ? new Razorpay({ key_id: KEY_ID, key_secret: KEY_SECRET })
  : null;

export const razorpayKeyId = KEY_ID;

/** Amount arrives in rupees; Razorpay works in paise. */
export async function createOrder({ amountRupees, receipt, notes }) {
  if (!client) return null;

  return client.orders.create({
    amount: Math.round(amountRupees * 100),
    currency: "INR",
    receipt,
    notes,
  });
}

/**
 * Confirms the payment really came from Razorpay.
 *
 * The browser tells us the payment succeeded, and a browser can be lied to. The
 * signature is an HMAC of order_id|payment_id using our secret, which only
 * Razorpay and this server know — so verifying it server-side is what makes the
 * result trustworthy.
 */
export function verifySignature({ orderId, paymentId, signature }) {
  if (!KEY_SECRET) return false;

  const expected = crypto
    .createHmac("sha256", KEY_SECRET)
    .update(`${orderId}|${paymentId}`)
    .digest("hex");

  // Constant-time compare so an attacker cannot narrow the signature by timing.
  const a = Buffer.from(expected);
  const b = Buffer.from(String(signature ?? ""));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
