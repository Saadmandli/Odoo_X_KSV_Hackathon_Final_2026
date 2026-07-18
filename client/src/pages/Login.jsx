import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowRight, Eye, EyeOff, Lock, Mail, Sparkles } from "lucide-react";
import { useAuth } from "../lib/auth";
import { Banner, Wordmark } from "../components/ui";

const TEST_ACCOUNTS = [
  { name: "Prayag Panchani", email: "prayag@northbridge.in", password: "password123" },
  { name: "Saad Mandli", email: "saad@northbridge.in", password: "password123" },
  { name: "Ishita Rao", email: "ishita@northbridge.in", password: "password123" },
  { name: "Shrey Naik", email: "shrey@northbridge.in", password: "admin123" },
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
    <div className="safe-top safe-bottom relative flex min-h-screen w-full items-center justify-center overflow-hidden bg-gradient-to-br from-emerald-50 via-slate-50 to-teal-100/60 px-4 py-12 selection:bg-emerald-500 selection:text-white">
      {/* Abstract Pure-CSS Eco-Tech Mesh Orbs */}
      <div className="pointer-events-none absolute -left-20 -top-20 h-96 w-96 rounded-full bg-emerald-300/30 blur-3xl" />
      <div className="pointer-events-none absolute -right-20 -bottom-20 h-96 w-96 rounded-full bg-teal-300/30 blur-3xl" />
      <div className="pointer-events-none absolute left-1/2 top-1/3 h-80 w-80 -translate-x-1/2 rounded-full bg-emerald-200/20 blur-3xl" />

      {/* Sleek Glassmorphism Container */}
      <div className="relative z-10 w-full max-w-md rounded-2xl border border-white/60 bg-white/85 p-8 shadow-[0_25px_50px_-12px_rgba(0,0,0,0.05),0_10px_15px_-3px_rgba(0,0,0,0.03)] backdrop-blur-md sm:p-10 transition-all duration-300">
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <Wordmark size="lg" />
            <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200/80 bg-emerald-50/80 px-2.5 py-1 text-[11px] font-semibold text-emerald-800 shadow-2xs">
              <Sparkles size={12} className="text-emerald-600" /> Enterprise
            </span>
          </div>
          
          <p className="mt-2 text-xs font-semibold uppercase tracking-wider text-emerald-700">
            Share the drive · Cut the carbon
          </p>

          <h1 className="mt-6 text-2xl font-bold tracking-tight text-slate-800">
            Welcome back
          </h1>
          <p className="mt-1.5 text-sm text-slate-500">
            Sign in with your work email to find or offer a ride.
          </p>
        </div>

        <form onSubmit={submit} className="space-y-5">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5" htmlFor="email">
              Work email
            </label>
            <div className="relative">
              <div className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400">
                <Mail size={17} />
              </div>
              <input
                id="email"
                className="w-full rounded-xl border border-slate-200/90 bg-white/90 pl-10 pr-4 py-3 text-sm font-medium text-slate-900 placeholder:text-slate-400 transition-all duration-200 focus:border-emerald-500 focus:bg-white focus:outline-none focus:ring-4 focus:ring-emerald-500/20"
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
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5" htmlFor="password">
              Password
            </label>
            <div className="relative">
              <div className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400">
                <Lock size={17} />
              </div>
              <input
                id="password"
                className="w-full rounded-xl border border-slate-200/90 bg-white/90 pl-10 pr-11 py-3 text-sm font-medium text-slate-900 placeholder:text-slate-400 transition-all duration-200 focus:border-emerald-500 focus:bg-white focus:outline-none focus:ring-4 focus:ring-emerald-500/20"
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

          <button
            className="group relative flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 via-emerald-700 to-teal-700 px-5 py-3.5 text-sm font-semibold text-white shadow-md shadow-emerald-700/20 transition-all duration-200 hover:from-emerald-700 hover:to-teal-800 hover:shadow-lg hover:shadow-emerald-700/30 active:scale-[0.99] disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
            disabled={busy}
          >
            <span>{busy ? "Signing in..." : "Sign in"}</span>
            {!busy && <ArrowRight size={17} className="transition-transform group-hover:translate-x-1" />}
          </button>
        </form>

        <p className="mt-6 text-center text-sm font-medium text-slate-500">
          New here?{" "}
          <Link to="/signup" className="font-semibold text-emerald-700 transition hover:text-emerald-800 hover:underline">
            Create an account
          </Link>
        </p>

        {/* Test Accounts Quick-Login Switcher */}
        <div className="mt-8 border-t border-slate-200/60 pt-6">
          <div className="mb-3.5 flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Demo Test Accounts
            </span>
            <span className="rounded-md bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 border border-emerald-200/60">
              Auto-fill
            </span>
          </div>

          {/* Named after people rather than roles: every employee both offers
              and books rides, so labelling them Driver or Rider would misstate
              the model. Only administration is a separate job. */}
          <div className="grid grid-cols-2 gap-2.5">
            {TEST_ACCOUNTS.map(({ name, email, password }) => {
              const isSelected = form.email === email;
              return (
                <button
                  key={email}
                  type="button"
                  onClick={() => setForm({ email, password })}
                  className={`group flex items-center justify-between rounded-xl border p-3 text-left transition-all duration-200 hover:-translate-y-0.5 hover:shadow-xs active:scale-[0.99] cursor-pointer ${
                    isSelected
                      ? "border-emerald-500 bg-emerald-50/80 ring-2 ring-emerald-500/20 shadow-xs"
                      : "border-slate-200/90 bg-white/70 hover:border-emerald-300 hover:bg-emerald-50/40"
                  }`}
                >
                  <span className="text-xs font-bold text-slate-800 group-hover:text-emerald-950">
                    {name}
                  </span>
                  <span className="text-[10px] font-bold text-slate-400 group-hover:text-emerald-700 transition-transform group-hover:translate-x-0.5">
                    →
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
