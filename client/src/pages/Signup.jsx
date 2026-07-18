import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { useAuth } from "../lib/auth";
import { Banner, Wordmark } from "../components/ui";

export default function Signup() {
  const { signup } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: "", phone: "", email: "", password: "", confirm: "" });
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
    <div className="safe-top safe-bottom flex min-h-full items-center justify-center bg-white px-5 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex items-center gap-3">
          <Link
            to="/login"
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100"
            aria-label="Back to sign in"
          >
            <ArrowLeft size={19} />
          </Link>
          <Wordmark />
        </div>

        <h1 className="text-[26px] font-semibold leading-tight tracking-tight text-slate-900">
          Create your account
        </h1>
        <p className="mt-1.5 text-[15px] text-slate-500">
          Use the email address issued by your employer. Your organisation must already be
          registered.
        </p>

        <form onSubmit={submit} className="mt-7 space-y-4">
          <div>
            <label className="label" htmlFor="name">
              Full name
            </label>
            <input id="name" className="field" required value={form.name} onChange={set("name")} />
          </div>

          <div>
            <label className="label" htmlFor="phone">
              Mobile number
            </label>
            <input
              id="phone"
              className="field"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              value={form.phone}
              onChange={set("phone")}
              placeholder="+91 98765 43210"
            />
            <p className="mt-1 text-xs text-slate-500">
              Shared with your co-riders so they can reach you on the day.
            </p>
          </div>

          <div>
            <label className="label" htmlFor="email">
              Work email
            </label>
            <input
              id="email"
              className="field"
              type="email"
              inputMode="email"
              autoCapitalize="none"
              required
              value={form.email}
              onChange={set("email")}
              placeholder="you@company.com"
            />
          </div>

          <div>
            <label className="label" htmlFor="password">
              Password
            </label>
            <input
              id="password"
              className="field"
              type="password"
              required
              minLength={6}
              value={form.password}
              onChange={set("password")}
            />
            <p className="mt-1 text-xs text-slate-500">At least 6 characters.</p>
          </div>

          <div>
            <label className="label" htmlFor="confirm">
              Confirm password
            </label>
            <input
              id="confirm"
              className="field"
              type="password"
              required
              value={form.confirm}
              onChange={set("confirm")}
            />
          </div>

          <Banner>{error}</Banner>

          <button className="btn-primary w-full" disabled={busy}>
            {busy ? "Creating account" : "Create account"}
          </button>
        </form>

        <p className="mt-6 text-center text-[15px] text-slate-500">
          Already registered?{" "}
          <Link to="/login" className="font-medium text-brand-700 hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
