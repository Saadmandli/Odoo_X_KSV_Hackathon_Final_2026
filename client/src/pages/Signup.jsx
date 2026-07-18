import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  CircleAlert,
  CircleCheck,
  Eye,
  EyeOff,
  Lock,
  Mail,
  Phone,
  User,
} from "lucide-react";
import { useAuth } from "../lib/auth";
import { get } from "../lib/api";
import { filterName, filterPhone } from "../lib/inputs";
import { AuthShell } from "../components/AuthShell";
import { Banner } from "../components/ui";

export default function Signup() {
  const { signup } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    name: "",
    phone: "",
    email: "",
    password: "",
    confirm: "",
    gender: "UNDISCLOSED",
  });
  const [org, setOrg] = useState(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
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
        gender: form.gender,
      });
      navigate("/dashboard");
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthShell>
      <div className="card p-7 sm:p-8">
        <Link
          to="/login"
          className="mb-5 inline-flex items-center gap-1.5 text-[13px] font-semibold text-slate-500 transition hover:text-brand-700"
        >
          <ArrowLeft size={15} />
          Back to sign in
        </Link>

        <h1 className="text-[26px] font-black tracking-tight text-slate-900">
          Create your account
        </h1>
        <p className="mt-1.5 text-sm text-slate-500">
          Use the email address issued by your employer. Your organization must be registered.
        </p>

        <form onSubmit={submit} className="mt-6 space-y-4">
          <div>
            <label className="label" htmlFor="name">
              Full name
            </label>
            <div className="relative">
              <div className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400">
                <User size={17} />
              </div>
              <input
                id="name"
                className="field pl-10"
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: filterName(e.target.value) })}
                placeholder="Jane Doe"
              />
            </div>
          </div>

          {/* Optional, and labelled as such. It exists so women-only rides can
              work; anyone who skips it keeps the rest of the product. */}
          <div>
            <label className="label">
              Gender <span className="font-medium normal-case text-slate-400">(optional)</span>
            </label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { value: "FEMALE", label: "Female" },
                { value: "MALE", label: "Male" },
                { value: "UNDISCLOSED", label: "Skip" },
              ].map((c) => (
                <button
                  key={c.value}
                  type="button"
                  onClick={() => setForm({ ...form, gender: c.value })}
                  className={`min-h-[42px] rounded-xl border px-2 text-[13px] font-semibold transition ${
                    form.gender === c.value
                      ? "border-brand-500 bg-brand-50 text-brand-800 ring-4 ring-brand-500/10"
                      : "border-slate-200 bg-white text-slate-600 hover:border-brand-300"
                  }`}
                >
                  {c.label}
                </button>
              ))}
            </div>
            <p className="mt-1 text-xs text-slate-500">
              Used only to match women-only rides. You can change it later.
            </p>
          </div>

          <div>
            <label className="label" htmlFor="phone">
              Mobile number
            </label>
            <div className="relative">
              <div className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400">
                <Phone size={17} />
              </div>
              <input
                id="phone"
                className="field pl-10"
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: filterPhone(e.target.value) })}
                placeholder="+91 98765 43210"
              />
            </div>
            <p className="mt-1 text-xs text-slate-500">Shared with co-riders for pickup coordination.</p>
          </div>

          <div>
            <label className="label" htmlFor="email">
              Work email
            </label>
            <div className="relative">
              <div className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400">
                <Mail size={17} />
              </div>
              <input
                id="email"
                className="field pl-10"
                type="email"
                inputMode="email"
                autoCapitalize="none"
                required
                value={form.email}
                onChange={set("email")}
                placeholder="you@company.com"
              />
            </div>

            {/* The email domain decides which organisation someone joins, so
                resolve it as they type rather than letting them find out by
                being rejected on submit. */}
            {org?.registered && (
              <div className="mt-2 flex items-center gap-2 rounded-xl border border-brand-200 bg-brand-50 px-3 py-2">
                <Building2 size={15} className="shrink-0 text-brand-600" />
                <span className="min-w-0 text-sm text-brand-800">
                  You will join <span className="font-semibold">{org.name}</span>
                </span>
                <CircleCheck size={15} className="ml-auto shrink-0 text-brand-600" />
              </div>
            )}

            {org && org.registered === false && (
              <div className="mt-2 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2">
                <CircleAlert size={15} className="mt-0.5 shrink-0 text-amber-600" />
                <span className="text-sm text-amber-800">
                  <span className="font-semibold">{org.domain}</span> is not registered. Ask your
                  administrator to add your company first.
                </span>
              </div>
            )}
          </div>

          <div>
            <label className="label" htmlFor="password">
              Password
            </label>
            <div className="relative">
              <div className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400">
                <Lock size={17} />
              </div>
              <input
                id="password"
                className="field pl-10"
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
            <label className="label" htmlFor="confirm">
              Confirm password
            </label>
            <div className="relative">
              <div className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400">
                <Lock size={17} />
              </div>
              <input
                id="confirm"
                className="field pl-10"
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
            className="btn-primary group w-full"
            disabled={busy || org?.registered === false}
          >
            <span>{busy ? "Creating account..." : "Create account"}</span>
            {!busy && <ArrowRight size={17} className="transition-transform group-hover:translate-x-1" />}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-slate-500">
          Already registered?{" "}
          <Link to="/login" className="font-semibold text-brand-700 hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </AuthShell>
  );
}
