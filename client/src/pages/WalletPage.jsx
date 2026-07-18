import { useEffect, useState } from "react";
import { ArrowDownLeft, ArrowUpRight, Plus, WalletMinimal } from "lucide-react";
import { get, post } from "../lib/api";
import { useAuth } from "../lib/auth";
import { loadRazorpay, openCheckout } from "../lib/razorpay";
import { Banner, EmptyState, Sheet, Spinner, money, when } from "../components/ui";

const QUICK_AMOUNTS = [200, 500, 1000, 2000];

export default function WalletPage() {
  const { user } = useAuth();
  const [wallet, setWallet] = useState(null);
  const [gateway, setGateway] = useState(null);
  const [showTopUp, setShowTopUp] = useState(false);
  const [amount, setAmount] = useState(500);
  const [method, setMethod] = useState("UPI");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const load = () => get("/payments/wallet").then(setWallet).catch((e) => setError(e.message));

  useEffect(() => {
    load();
    get("/payments/config").then(setGateway).catch(() => {});
  }, []);

  const topUp = async () => {
    setBusy(true);
    setError("");

    try {
      const order = await post("/payments/wallet/recharge/order", {
        amount: Number(amount),
        method,
      });

      // No gateway keys configured: credit directly so the flow still works.
      if (order.sandbox) {
        await post("/payments/wallet/recharge/confirm", { amount: Number(amount), method });
        return finish();
      }

      if (!(await loadRazorpay())) {
        throw new Error("Could not reach the payment gateway. Try again in a moment.");
      }

      const result = await openCheckout({
        keyId: order.keyId,
        orderId: order.orderId,
        amount: order.amount,
        name: "Carpool",
        description: "Wallet top-up",
        prefill: { name: user.name, email: user.email, contact: user.phone ?? "" },
      });

      if (!result) {
        setBusy(false);
        return;
      }

      await post("/payments/wallet/recharge/confirm", {
        amount: Number(amount),
        method,
        ...result,
      });
      finish();
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  const finish = async () => {
    await load();
    setShowTopUp(false);
    setBusy(false);
  };

  if (!wallet) return error ? <Banner>{error}</Banner> : <Spinner label="Loading wallet" />;

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-xl font-semibold tracking-tight text-slate-900">Wallet</h1>

      <div className="mt-4 overflow-hidden rounded-xl2 bg-brand-700 p-5 text-white shadow-card">
        <div className="flex items-center gap-2 text-brand-100">
          <WalletMinimal size={15} />
          <span className="text-sm">Available balance</span>
        </div>
        <div className="mt-1 text-3xl font-semibold tracking-tight">{money(wallet.balance)}</div>
        <button
          onClick={() => setShowTopUp(true)}
          className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-white/15 px-3 py-2 text-sm font-medium backdrop-blur transition hover:bg-white/25"
        >
          <Plus size={15} />
          Add money
        </button>
      </div>

      <p className="mb-2 mt-6 px-1 text-xs font-medium uppercase tracking-wide text-slate-400">
        Recent activity
      </p>

      {wallet.transactions.length === 0 ? (
        <EmptyState
          icon={WalletMinimal}
          title="No transactions yet"
          hint="Top up your wallet to pay for rides in one tap."
        />
      ) : (
        <div className="card divide-y divide-slate-100">
          {wallet.transactions.map((t) => {
            const credit = t.type === "CREDIT";
            return (
              <div key={t.id} className="flex items-center gap-3 p-4">
                <span
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${
                    credit ? "bg-brand-50 text-brand-700" : "bg-slate-100 text-slate-500"
                  }`}
                >
                  {credit ? <ArrowDownLeft size={16} /> : <ArrowUpRight size={16} />}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[15px] text-slate-800">{t.description}</div>
                  <div className="text-xs text-slate-500">{when(t.createdAt)}</div>
                </div>
                <div
                  className={`shrink-0 text-[15px] font-semibold ${
                    credit ? "text-brand-700" : "text-slate-700"
                  }`}
                >
                  {credit ? "+" : "−"}
                  {money(t.amount)}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Sheet open={showTopUp} onClose={() => !busy && setShowTopUp(false)} title="Add money">
        <label className="label">Amount</label>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">₹</span>
          <input
            type="number"
            inputMode="numeric"
            min="1"
            className="field pl-7"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
        </div>

        <div className="mt-2 flex gap-2">
          {QUICK_AMOUNTS.map((a) => (
            <button
              key={a}
              onClick={() => setAmount(a)}
              className={`flex-1 rounded-lg border py-2 text-sm transition ${
                Number(amount) === a
                  ? "border-brand-600 bg-brand-50 text-brand-700"
                  : "border-slate-200 text-slate-600"
              }`}
            >
              ₹{a}
            </button>
          ))}
        </div>

        <label className="label mt-4">Pay using</label>
        <div className="grid grid-cols-2 gap-2">
          {[
            ["UPI", "UPI"],
            ["CARD", "Card"],
          ].map(([key, label]) => (
            <button
              key={key}
              onClick={() => setMethod(key)}
              className={`rounded-lg border py-2.5 text-sm transition ${
                method === key
                  ? "border-brand-600 bg-brand-50 text-brand-700"
                  : "border-slate-200 text-slate-600"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="mt-4">
          <Banner>{error}</Banner>
        </div>

        <button
          className="btn-primary mt-4 w-full"
          onClick={topUp}
          disabled={busy || Number(amount) <= 0}
        >
          {busy ? "Processing" : `Add ${money(amount)}`}
        </button>

        {gateway?.razorpayEnabled ? (
          <p className="mt-2 text-center text-xs text-slate-400">
            Secured by Razorpay · test mode
          </p>
        ) : (
          <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-center text-xs text-amber-800">
            Payment gateway is not configured. The balance will be credited
            without a live transaction.
          </p>
        )}
      </Sheet>
    </div>
  );
}
