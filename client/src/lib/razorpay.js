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
 * Radix dialogs (our bottom sheets) set `pointer-events: none` on <body> and
 * trap focus while open. Razorpay's checkout mounts outside that dialog, so it
 * renders but swallows every click. Callers should close their sheet first;
 * this clears the leftover inline styles in case one lingers.
 */
function releaseModalLock() {
  document.body.style.pointerEvents = "";
  document.body.removeAttribute("data-scroll-locked");
  // Radix marks background content inert while a dialog is open.
  document.querySelectorAll("[aria-hidden='true'][data-aria-hidden]").forEach((el) => {
    el.removeAttribute("aria-hidden");
    el.removeAttribute("data-aria-hidden");
  });
}

/**
 * Opens Razorpay checkout and resolves with the payment result.
 * Resolves null if the user closes the sheet, so callers can tell "cancelled"
 * apart from "failed".
 */
export function openCheckout({ keyId, orderId, amount, name, description, prefill }) {
  releaseModalLock();

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
