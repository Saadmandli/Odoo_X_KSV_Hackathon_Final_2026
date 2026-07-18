import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Eye, EyeOff } from "lucide-react";
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
    <div className="safe-top safe-bottom flex min-h-full items-center justify-center bg-white px-5 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-8">
          <Wordmark size="lg" />
          <p className="mt-1 text-[13px] font-medium tracking-wide text-brand-700">
            Share the drive. Cut the carbon.
          </p>

          <h1 className="mt-7 text-[26px] font-semibold leading-tight tracking-tight text-slate-900">
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

        <div className="mt-10">
          <p className="mb-1 text-center text-xs font-medium uppercase tracking-wide text-slate-400">
            Test accounts
          </p>
          {/* Deliberately named after people, not roles. Every employee both
              offers and books rides; only administration is a separate job. */}
          <p className="mb-3 text-center text-xs text-slate-500">
            Any employee can offer a ride or book a seat.
          </p>
          <div className="grid grid-cols-2 gap-2">
            {TEST_ACCOUNTS.map(({ name, email, password }) => (
              <button
                key={email}
                type="button"
                onClick={() => setForm({ email, password })}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-800 transition hover:bg-slate-50 active:bg-slate-100"
              >
                {name}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
