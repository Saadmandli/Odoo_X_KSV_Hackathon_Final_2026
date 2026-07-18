import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, Building2, CircleAlert, CircleCheck } from "lucide-react";
import { useAuth } from "../lib/auth";
import { get } from "../lib/api";
import { Banner, Wordmark } from "../components/ui";

export default function Signup() {
  const { signup } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: "", phone: "", email: "", password: "", confirm: "" });
  const [org, setOrg] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  // The email domain decides which organisation someone joins, so resolve it
  // as they type rather than letting them discover the rule by being rejected.
  const domain = form.email.includes("@") ? form.email.split("@")[1].trim().toLowerCase() : "";

  useEffect(() => {
    if (!domain || !domain.includes(".")) {
      setOrg(null);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        setOrg(await get(`/public/organization?domain=${encodeURIComponent(domain)}`));
      } catch {
        setOrg({ registered: false, domain });
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [domain]);

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

            {org?.registered && (
              <div className="mt-2 flex items-center gap-2 rounded-lg border border-brand-200 bg-brand-50 px-3 py-2">
                <Building2 size={15} className="shrink-0 text-brand-600" />
                <span className="min-w-0 text-sm text-brand-800">
                  You will join <span className="font-medium">{org.name}</span>
                </span>
                <CircleCheck size={15} className="ml-auto shrink-0 text-brand-600" />
              </div>
            )}

            {org && org.registered === false && (
              <div className="mt-2 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
                <CircleAlert size={15} className="mt-0.5 shrink-0 text-amber-600" />
                <span className="text-sm text-amber-800">
                  <span className="font-medium">{org.domain}</span> is not registered. Ask your
                  administrator to add your company first.
                </span>
              </div>
            )}
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

          <button className="btn-primary w-full" disabled={busy || org?.registered === false}>
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
