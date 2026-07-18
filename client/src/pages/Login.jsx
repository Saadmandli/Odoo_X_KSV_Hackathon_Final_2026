import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowRight, Eye, EyeOff, Lock, Mail } from "lucide-react";
import { useAuth } from "../lib/auth";
import { AuthShell } from "../components/AuthShell";
import { Avatar, Banner } from "../components/ui";

/* Named after people rather than roles: every employee both offers and books
   rides, so labelling them Driver or Rider would misstate the model. Only
   administration is a separate job, and it is the one label shown. */
const TEST_ACCOUNTS = [
  { name: "Prayag Panchani", email: "prayag@northbridge.in", password: "password123" },
  { name: "Saad Mandli", email: "saad@northbridge.in", password: "password123" },
  { name: "Ishita Rao", email: "ishita@northbridge.in", password: "password123" },
  { name: "Shrey Naik", email: "shrey@northbridge.in", password: "admin123", admin: true },
];

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: "", password: "" });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const user = await login(form.email.trim(), form.password);
      navigate(user.role === "ADMIN" ? "/admin" : "/dashboard");
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthShell>
      <div className="card p-7 sm:p-8">
        <h1 className="text-[26px] font-black tracking-tight text-slate-900">Welcome back</h1>
        <p className="mt-1.5 text-sm text-slate-500">
          Sign in with your work email to find or offer a ride.
        </p>

        <form onSubmit={submit} className="mt-7 space-y-5">
          <div>
            <label className="label" htmlFor="email">
              Work email
            </label>
            <div className="relative">
              <Mail
                size={17}
                className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
              />
              <input
                id="email"
                className="field pl-10"
                type="email"
                inputMode="email"
                autoComplete="email"
                autoCapitalize="none"
                required
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="you@company.com"
              />
            </div>
          </div>

          <div>
            <label className="label" htmlFor="password">
              Password
            </label>
            <div className="relative">
              <Lock
                size={17}
                className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
              />
              <input
                id="password"
                className="field pl-10 pr-11"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                required
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                placeholder="••••••••"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? "Hide password" : "Show password"}
                className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
              >
                {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
              </button>
            </div>
          </div>

          <Banner>{error}</Banner>

          <button className="btn-primary group w-full" disabled={busy}>
            <span>{busy ? "Signing in…" : "Sign in"}</span>
            {!busy && (
              <ArrowRight size={17} className="transition-transform group-hover:translate-x-1" />
            )}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-slate-500">
          New here?{" "}
          <Link to="/signup" className="font-semibold text-brand-700 hover:underline">
            Create an account
          </Link>
        </p>
      </div>

      <DemoAccounts selected={form.email} onPick={setForm} />
    </AuthShell>
  );
}

/**
 * One-tap credentials for the demo organisation.
 *
 * Shown as people with faces rather than a table of strings: whoever is
 * driving the demo has to pick the right person under time pressure, and
 * "Prayag" next to Prayag's avatar is faster to find than a row of addresses.
 */
function DemoAccounts({ selected, onPick }) {
  return (
    <div className="mt-6">
      <div className="mb-3 flex items-center gap-3">
        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
          Demo accounts
        </span>
        <span className="h-px flex-1 bg-slate-200" />
        <span className="text-[11px] font-semibold text-slate-400">Tap to fill</span>
      </div>

      <div className="grid grid-cols-2 gap-2.5">
        {TEST_ACCOUNTS.map(({ name, email, password, admin }) => {
          const isSelected = selected === email;
          return (
            <button
              key={email}
              type="button"
              onClick={() => onPick({ email, password })}
              className={`group flex items-center gap-2.5 rounded-xl border p-2.5 text-left transition-all duration-200 hover:-translate-y-0.5 hover:shadow-card active:scale-[0.99] ${
                isSelected
                  ? "border-brand-500 bg-brand-50 ring-4 ring-brand-500/10"
                  : "border-slate-200 bg-white hover:border-brand-300"
              }`}
            >
              <Avatar name={name} size={28} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[12.5px] font-bold text-slate-800">
                  {name.split(" ")[0]}
                </span>
                <span className="block truncate text-[10.5px] font-medium text-slate-400">
                  {admin ? "Administrator" : "Employee"}
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
