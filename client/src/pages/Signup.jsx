import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, ArrowRight, Eye, EyeOff, Lock, Mail, Phone, User } from "lucide-react";
import { useAuth } from "../lib/auth";
import { Banner, Wordmark } from "../components/ui";

export default function Signup() {
  const { signup } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: "", phone: "", email: "", password: "", confirm: "" });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setError("");

    if (form.password !== form.confirm) {
      setError("Those passwords do not match.");
      return;
    }

    setBusy(true);
    try {
      await signup({
        name: form.name.trim(),
        email: form.email.trim(),
        password: form.password,
        phone: form.phone.trim() || undefined,
      });
      navigate("/dashboard");
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
        <div className="mb-6 flex items-center justify-between">
          <Link
            to="/login"
            className="inline-flex h-9 w-9 items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100 hover:text-slate-900 transition"
            aria-label="Back to sign in"
          >
            <ArrowLeft size={19} />
          </Link>
          <Wordmark size="md" />
        </div>

        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          Create your account
        </h1>
        <p className="mt-1.5 text-sm text-slate-500">
          Use the email address issued by your employer. Your organization must be registered.
        </p>

        <form onSubmit={submit} className="mt-6 space-y-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5" htmlFor="name">
              Full name
            </label>
            <div className="relative">
              <div className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400">
                <User size={17} />
              </div>
              <input
                id="name"
                className="w-full rounded-xl border border-slate-200 bg-slate-50/40 pl-10 pr-4 py-3 text-sm font-medium text-slate-900 placeholder:text-slate-400 transition-all duration-200 focus:border-emerald-500 focus:bg-white focus:outline-none focus:ring-4 focus:ring-emerald-500/10"
                required
                value={form.name}
                onChange={set("name")}
                placeholder="Jane Doe"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5" htmlFor="phone">
              Mobile number
            </label>
            <div className="relative">
              <div className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400">
                <Phone size={17} />
              </div>
              <input
                id="phone"
                className="w-full rounded-xl border border-slate-200 bg-slate-50/40 pl-10 pr-4 py-3 text-sm font-medium text-slate-900 placeholder:text-slate-400 transition-all duration-200 focus:border-emerald-500 focus:bg-white focus:outline-none focus:ring-4 focus:ring-emerald-500/10"
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                value={form.phone}
                onChange={set("phone")}
                placeholder="+91 98765 43210"
              />
            </div>
            <p className="mt-1 text-xs text-slate-500">Shared with co-riders for pickup coordination.</p>
          </div>

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
                className="w-full rounded-xl border border-slate-200 bg-slate-50/40 pl-10 pr-4 py-3 text-sm font-medium text-slate-900 placeholder:text-slate-400 transition-all duration-200 focus:border-emerald-500 focus:bg-white focus:outline-none focus:ring-4 focus:ring-emerald-500/10"
                type="email"
                inputMode="email"
                autoCapitalize="none"
                required
                value={form.email}
                onChange={set("email")}
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
                className="w-full rounded-xl border border-slate-200 bg-slate-50/40 pl-10 pr-11 py-3 text-sm font-medium text-slate-900 placeholder:text-slate-400 transition-all duration-200 focus:border-emerald-500 focus:bg-white focus:outline-none focus:ring-4 focus:ring-emerald-500/10"
                type={showPassword ? "text" : "password"}
                required
                minLength={6}
                value={form.password}
                onChange={set("password")}
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
            <p className="mt-1 text-xs text-slate-500">At least 6 characters.</p>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5" htmlFor="confirm">
              Confirm password
            </label>
            <div className="relative">
              <div className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400">
                <Lock size={17} />
              </div>
              <input
                id="confirm"
                className="w-full rounded-xl border border-slate-200 bg-slate-50/40 pl-10 pr-11 py-3 text-sm font-medium text-slate-900 placeholder:text-slate-400 transition-all duration-200 focus:border-emerald-500 focus:bg-white focus:outline-none focus:ring-4 focus:ring-emerald-500/10"
                type={showConfirmPassword ? "text" : "password"}
                required
                value={form.confirm}
                onChange={set("confirm")}
                placeholder="••••••••"
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword((v) => !v)}
                aria-label={showConfirmPassword ? "Hide password" : "Show password"}
                className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
              >
                {showConfirmPassword ? <EyeOff size={17} /> : <Eye size={17} />}
              </button>
            </div>
          </div>

          <Banner>{error}</Banner>

          <button
            className="group relative flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 via-emerald-700 to-teal-700 px-5 py-3.5 text-sm font-semibold text-white shadow-md shadow-emerald-700/20 transition-all duration-200 hover:from-emerald-700 hover:to-teal-800 hover:shadow-lg hover:shadow-emerald-700/30 active:scale-[0.99] disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
            disabled={busy}
          >
            <span>{busy ? "Creating account..." : "Create account"}</span>
            {!busy && <ArrowRight size={17} className="transition-transform group-hover:translate-x-1" />}
          </button>
        </form>

        <p className="mt-6 text-center text-sm font-medium text-slate-500">
          Already registered?{" "}
          <Link to="/login" className="font-semibold text-emerald-700 transition hover:text-emerald-800 hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
