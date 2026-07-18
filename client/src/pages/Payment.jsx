import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Banknote, Check, CreditCard, Smartphone, Wallet } from "lucide-react";
import { get, post } from "../lib/api";
import { useAuth } from "../lib/auth";
import { loadRazorpay, openCheckout } from "../lib/razorpay";
import { Banner, Spinner, money } from "../components/ui";

const METHODS = [
  { key: "CASH", label: "Cash", hint: "Hand the fare to the driver", icon: Banknote },
  { key: "CARD", label: "Card", hint: "Debit or credit card", icon: CreditCard },
  { key: "UPI", label: "UPI", hint: "Any UPI app or QR", icon: Smartphone },
  { key: "WALLET", label: "Wallet", hint: "Pay from your balance", icon: Wallet },
];

export default function Payment() {
  const { bookingId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [booking, setBooking] = useState(null);
  const [wallet, setWallet] = useState(null);
  const [method, setMethod] = useState("WALLET");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    Promise.all([get("/bookings/my-trips"), get("/payments/wallet")])
      .then(([trips, w]) => {
        setBooking(trips.asPassenger.find((b) => b.id === bookingId) ?? null);
        setWallet(w);
      })
      .catch((err) => setError(err.message));
  }, [bookingId]);

  const pay = async () => {
    setBusy(true);
    setError("");

    try {
      // Cash and wallet settle entirely on our side.
      if (method === "CASH" || method === "WALLET") {
        await post("/payments/pay", { bookingId, method });
        return finish();
      }

      // Card and UPI go through Razorpay.
      const order = await post("/payments/order", { bookingId });

      if (order.sandbox) {
        // No keys configured: record the payment so the flow still completes.
        await post("/payments/pay", { bookingId, method });
        return finish();
      }

      if (!(await loadRazorpay())) {
        throw new Error("Could not reach the payment gateway. Try wallet or cash.");
      }

      const result = await openCheckout({
        keyId: order.keyId,
        orderId: order.orderId,
        amount: order.amount,
        name: "Carpool",
        description: `Ride to ${booking.ride.destLabel.split(",")[0]}`,
        prefill: { name: user.name, email: user.email, contact: user.phone ?? "" },
      });

      if (!result) {
        setBusy(false);
        return; // user closed the sheet
      }

      await post("/payments/pay", { bookingId, method, ...result });
      finish();
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  const finish = () => {
    setDone(true);
    setBusy(false);
    setTimeout(() => navigate("/trips"), 1400);
  };

  if (error && !booking) return <Banner>{error}</Banner>;
  if (!booking) return <Spinner label="Loading payment" />;

  const amount = booking.fareAmount;
  const balance = wallet?.balance ?? 0;
  const shortOnWallet = method === "WALLET" && balance < amount;

  if (done) {
    return (
      <div className="mx-auto flex max-w-md flex-col items-center justify-center py-20 text-center">
        <span className="flex h-16 w-16 items-center justify-center rounded-full bg-brand-600 text-white">
          <Check size={30} />
        </span>
        <h1 className="mt-4 text-xl font-semibold text-slate-900">Payment complete</h1>
        <p className="mt-1 text-[15px] text-slate-500">
          {money(amount)} paid to {booking.ride.driver.name}.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md">
      <button
        onClick={() => navigate(-1)}
        className="mb-3 inline-flex items-center gap-1.5 text-sm text-slate-600"
      >
        <ArrowLeft size={16} />
        Back
      </button>

      <h1 className="text-xl font-semibold tracking-tight text-slate-900">Pay for your ride</h1>
      <p className="mt-1 text-[15px] text-slate-500">
        {booking.ride.originLabel.split(",")[0]} to {booking.ride.destLabel.split(",")[0]}
      </p>

      <div className="card mt-4 p-4">
        <div className="flex items-baseline justify-between">
          <span className="text-sm text-slate-600">Amount due</span>
          <span className="text-2xl font-semibold text-slate-900">{money(amount)}</span>
        </div>
        <div className="mt-1 text-xs text-slate-500">
          {booking.seats} {booking.seats === 1 ? "seat" : "seats"} · {booking.ride.distanceKm} km ·
          paid to {booking.ride.driver.name}
        </div>
      </div>

      <p className="mb-2 mt-5 px-1 text-xs font-medium uppercase tracking-wide text-slate-400">
        Payment method
      </p>

      <div className="space-y-2">
        {METHODS.map(({ key, label, hint, icon: Icon }) => {
          const selected = method === key;
          const isWallet = key === "WALLET";

          return (
            <button
              key={key}
              onClick={() => setMethod(key)}
              className={`flex w-full items-center gap-3 rounded-xl2 border p-3.5 text-left transition ${
                selected
                  ? "border-brand-600 bg-brand-50 ring-1 ring-brand-600"
                  : "border-slate-200 bg-white hover:bg-slate-50"
              }`}
            >
              <span
                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${
                  selected ? "bg-brand-600 text-white" : "bg-slate-100 text-slate-500"
                }`}
              >
                <Icon size={18} />
              </span>

              <span className="min-w-0 flex-1">
                <span className="block text-[15px] font-medium text-slate-900">{label}</span>
                <span className="block text-xs text-slate-500">
                  {isWallet ? `Balance ${money(balance)}` : hint}
                </span>
              </span>

              <span
                className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 ${
                  selected ? "border-brand-600 bg-brand-600 text-white" : "border-slate-300"
                }`}
              >
                {selected && <Check size={12} strokeWidth={3} />}
              </span>
            </button>
          );
        })}
      </div>

      {shortOnWallet && (
        <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-800">
          Short by {money(amount - balance)}.{" "}
          <button onClick={() => navigate("/wallet")} className="font-medium underline">
            Top up your wallet
          </button>
        </div>
      )}

      <div className="mt-4">
        <Banner>{error}</Banner>
      </div>

      <button className="btn-primary mt-4 w-full" onClick={pay} disabled={busy || shortOnWallet}>
        {busy ? "Processing" : `Pay ${money(amount)}`}
      </button>

      {["CARD", "UPI"].includes(method) && (
        <p className="mt-2 text-center text-xs text-slate-400">
          Card and UPI are processed by Razorpay in test mode.
        </p>
      )}
    </div>
  );
}
