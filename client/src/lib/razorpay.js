// Razorpay's checkout is a hosted script — it cannot be bundled, so it is
// loaded on demand the first time someone pays. Loading it lazily also means a
// blocked or slow CDN never delays the rest of the app.
let loader = null;

export function loadRazorpay() {
  if (window.Razorpay) return Promise.resolve(true);
  if (loader) return loader;

  loader = new Promise((resolve) => {
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.onload = () => resolve(true);
    script.onerror = () => {
      loader = null; // allow a retry on the next attempt
      resolve(false);
    };
    document.body.appendChild(script);
  });

  return loader;
}

/**
 * Opens Razorpay checkout and resolves with the payment result.
 * Resolves null if the user closes the sheet, so callers can tell "cancelled"
 * apart from "failed".
 */
export function openCheckout({ keyId, orderId, amount, name, description, prefill }) {
  return new Promise((resolve, reject) => {
    const rzp = new window.Razorpay({
      key: keyId,
      order_id: orderId,
      amount: Math.round(amount * 100),
      currency: "INR",
      name,
      description,
      prefill,
      theme: { color: "#286b57" },
      handler: (response) =>
        resolve({
          razorpayOrderId: response.razorpay_order_id,
          razorpayPaymentId: response.razorpay_payment_id,
          razorpaySignature: response.razorpay_signature,
        }),
      modal: { ondismiss: () => resolve(null) },
    });

    rzp.on("payment.failed", (e) =>
      reject(new Error(e.error?.description || "The payment did not go through"))
    );
    rzp.open();
  });
}
