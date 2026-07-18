import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Car, Eye, EyeOff } from "lucide-react";
import { useAuth } from "../lib/auth";
import { Banner } from "../components/ui";

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
    <div className="safe-top safe-bottom flex min-h-full flex-col bg-white">
      <div className="mx-auto flex w-full max-w-sm flex-1 flex-col px-5 pt-14 sm:justify-center sm:pt-0">
        <div className="mb-8">
          <span className="mb-5 flex h-12 w-12 items-center justify-center rounded-xl2 bg-brand-600 text-white">
            <Car size={24} />
          </span>
          <h1 className="text-[26px] font-semibold leading-tight tracking-tight text-slate-900">
            Welcome back
          </h1>
          <p className="mt-1.5 text-[15px] text-slate-500">
            Sign in with your work email to find or offer a ride.
          </p>
        </div>

        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="label" htmlFor="email">
              Work email
            </label>
            <input
              id="email"
              className="field"
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

          <div>
            <label className="label" htmlFor="password">
              Password
            </label>
            <div className="relative">
              <input
                id="password"
                className="field pr-11"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                required
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? "Hide password" : "Show password"}
                className="absolute right-1 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100"
              >
                {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
              </button>
            </div>
          </div>

          <Banner>{error}</Banner>

          <button className="btn-primary w-full" disabled={busy}>
            {busy ? "Signing in" : "Sign in"}
          </button>
        </form>

        <p className="mt-6 text-center text-[15px] text-slate-500">
          New here?{" "}
          <Link to="/signup" className="font-medium text-brand-700 hover:underline">
            Create an account
          </Link>
        </p>

        <div className="mt-auto pb-6 pt-10">
          <p className="mb-2 text-center text-xs font-medium uppercase tracking-wide text-slate-400">
            Reviewer access
          </p>
          <div className="grid grid-cols-3 gap-2">
            {[
              ["Driver", "prayag@northbridge.in", "password123"],
              ["Rider", "saad@northbridge.in", "password123"],
              ["Admin", "shrey@northbridge.in", "admin123"],
            ].map(([label, email, password]) => (
              <button
                key={label}
                type="button"
                onClick={() => setForm({ email, password })}
                className="btn-secondary btn-sm"
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
