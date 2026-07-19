import { useEffect, useState } from "react";
import {
  Building2,
  Globe,
  Plus,
  ShieldCheck,
  UserCog,
  Users,
  X,
} from "lucide-react";
import { del, get, post } from "../lib/api";
import { Avatar, Banner, EmptyState, Sheet, Spinner } from "../components/ui";

const BLANK = {
  name: "",
  domain: "",
  industry: "",
  registeredAddress: "",
  adminName: "",
  adminEmail: "",
  adminPassword: "",
};

export default function Platform() {
  const [orgs, setOrgs] = useState(null);
  const [error, setError] = useState("");
  const [creating, setCreating] = useState(false);
  const [managing, setManaging] = useState(null); // org whose admins are open

  const load = async () => {
    try {
      const { organizations } = await get("/platform/organizations");
      setOrgs(organizations);
    } catch (err) {
      setError(err.message);
    }
  };

  useEffect(() => {
    load();
  }, []);

  if (orgs === null) return error ? <Banner>{error}</Banner> : <Spinner label="Loading organisations" />;

  const totals = orgs.reduce(
    (t, o) => ({ employees: t.employees + o.employees, rides: t.rides + o.rides }),
    { employees: 0, rides: 0 }
  );

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <div className="min-w-0 flex-1">
          <h1 className="flex items-center gap-2 text-xl font-semibold tracking-tight text-slate-900">
            <Globe size={20} className="text-brand-600" />
            Platform
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Create organisations and appoint the administrator who runs each one.
          </p>
        </div>
        <button onClick={() => setCreating(true)} className="btn-primary">
          <Plus size={17} />
          New organisation
        </button>
      </div>

      <div className="mb-4 grid grid-cols-3 gap-3">
        {[
          ["Organisations", orgs.length, Building2],
          ["People", totals.employees, Users],
          ["Rides", totals.rides, ShieldCheck],
        ].map(([label, value, Icon]) => (
          <div key={label} className="card px-4 py-3">
            <div className="flex items-center gap-1.5 text-[12px] text-slate-500">
              <Icon size={13} />
              {label}
            </div>
            <div className="mt-0.5 text-xl font-semibold text-slate-900">{value}</div>
          </div>
        ))}
      </div>

      <Banner>{error}</Banner>

      {orgs.length === 0 ? (
        <EmptyState
          icon={Building2}
          title="No organisations yet"
          hint="Create the first company and appoint its administrator."
        />
      ) : (
        <div className="space-y-3">
          {orgs.map((o) => (
            <div key={o.id} className="card p-4">
              <div className="flex flex-wrap items-start gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-600 text-sm font-bold text-white">
                  {o.name.slice(0, 2).toUpperCase()}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="truncate text-[15.5px] font-semibold text-slate-900">{o.name}</div>
                  <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500">
                    <span className="rounded bg-slate-100 px-1.5 py-0.5 font-mono font-semibold text-slate-700">
                      @{o.domain}
                    </span>
                    {o.industry && <span>{o.industry}</span>}
                    <span>· {o.employees} people</span>
                    <span>· {o.rides} rides</span>
                  </div>
                </div>

                <button
                  onClick={() => setManaging(o)}
                  className="shrink-0 rounded-lg border border-slate-300 px-3 py-1.5 text-[13px] font-semibold text-slate-700 transition hover:bg-slate-50"
                >
                  <UserCog size={14} className="mr-1 inline" />
                  Administrators
                </button>
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  Run by
                </span>
                {o.admins.length === 0 ? (
                  <span className="text-xs font-medium text-amber-700">
                    No administrator — appoint one
                  </span>
                ) : (
                  o.admins.map((a) => (
                    <span
                      key={a.id}
                      className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 py-0.5 pl-0.5 pr-2.5"
                    >
                      <Avatar name={a.name} color={a.avatarColor} size={20} />
                      <span className="text-xs font-medium text-slate-700">{a.name}</span>
                      {a.role === "SUPER_ADMIN" && (
                        <span className="rounded bg-brand-600 px-1 text-[9.5px] font-bold uppercase text-white">
                          Owner
                        </span>
                      )}
                    </span>
                  ))
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <CreateOrg
        open={creating}
        onClose={() => setCreating(false)}
        onCreated={() => {
          setCreating(false);
          load();
        }}
      />

      <ManageAdmins org={managing} onClose={() => setManaging(null)} onChanged={load} />
    </div>
  );
}

function CreateOrg({ open, onClose, onCreated }) {
  const [form, setForm] = useState(BLANK);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  // The administrator has to sit on the company's own domain, so the address is
  // completed from what was typed above rather than left to be got wrong.
  const domain = form.domain.trim().toLowerCase();

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await post("/platform/organizations", { ...form, domain });
      setForm(BLANK);
      onCreated();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet open={open} onClose={onClose} title="New organisation">
      <form onSubmit={submit} className="space-y-3.5">
        <div>
          <label className="label">Company name</label>
          <input className="field" required value={form.name} onChange={set("name")} placeholder="Acme Technologies" />
        </div>

        <div>
          <label className="label">Email domain</label>
          <input
            className="field"
            required
            value={form.domain}
            onChange={set("domain")}
            placeholder="acme.com"
            autoCapitalize="none"
          />
          <p className="mt-1 text-xs text-slate-500">
            Everyone with an address at this domain joins automatically. It cannot be changed later.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className="label">Industry</label>
            <input className="field" value={form.industry} onChange={set("industry")} placeholder="Software" />
          </div>
          <div>
            <label className="label">Registered address</label>
            <input
              className="field"
              value={form.registeredAddress}
              onChange={set("registeredAddress")}
              placeholder="Ahmedabad, Gujarat"
            />
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
          <div className="mb-2.5 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-500">
            <ShieldCheck size={13} />
            Its administrator
          </div>

          <div className="space-y-3">
            <div>
              <label className="label">Full name</label>
              <input className="field" required value={form.adminName} onChange={set("adminName")} placeholder="Raj Patel" />
            </div>
            <div>
              <label className="label">Work email</label>
              <input
                className="field"
                type="email"
                required
                autoCapitalize="none"
                value={form.adminEmail}
                onChange={set("adminEmail")}
                placeholder={domain ? `raj@${domain}` : "raj@acme.com"}
              />
              {domain && (
                <p className="mt-1 text-xs text-slate-500">Must end in @{domain}.</p>
              )}
            </div>
            <div>
              <label className="label">Temporary password</label>
              <input
                className="field"
                required
                minLength={6}
                value={form.adminPassword}
                onChange={set("adminPassword")}
                placeholder="At least 6 characters"
              />
            </div>
          </div>
        </div>

        <Banner>{error}</Banner>

        <div className="flex gap-2">
          <button className="btn-primary flex-1" disabled={busy}>
            {busy ? "Creating..." : "Create organisation"}
          </button>
          <button type="button" onClick={onClose} className="rounded-xl border border-slate-300 px-4 text-sm font-semibold text-slate-600">
            Cancel
          </button>
        </div>
      </form>
    </Sheet>
  );
}

function ManageAdmins({ org, onClose, onChanged }) {
  const [people, setPeople] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");

  useEffect(() => {
    if (!org) {
      setPeople(null);
      return;
    }
    setError("");
    get(`/platform/organizations/${org.id}/people`)
      .then((d) => setPeople(d.people))
      .catch((e) => setError(e.message));
  }, [org]);

  const reload = async () => {
    const d = await get(`/platform/organizations/${org.id}/people`);
    setPeople(d.people);
    onChanged();
  };

  const appoint = async (userId) => {
    setBusy(userId);
    setError("");
    try {
      await post(`/platform/organizations/${org.id}/admins`, { userId });
      await reload();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy("");
    }
  };

  const stepDown = async (userId) => {
    setBusy(userId);
    setError("");
    try {
      await del(`/platform/organizations/${org.id}/admins/${userId}`);
      await reload();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy("");
    }
  };

  return (
    <Sheet open={Boolean(org)} onClose={onClose} title={org ? `${org.name} — administrators` : ""}>
      {people === null ? (
        <Spinner label="Loading people" />
      ) : (
        <div className="space-y-2">
          <Banner>{error}</Banner>

          {people.map((p) => {
            const isAdmin = p.role === "ADMIN" || p.role === "SUPER_ADMIN";
            const isOwner = p.role === "SUPER_ADMIN";

            return (
              <div
                key={p.id}
                className="flex items-center gap-3 rounded-xl border border-slate-200 px-3 py-2.5"
              >
                <Avatar name={p.name} color={p.avatarColor} size={34} />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[14.5px] font-medium text-slate-800">{p.name}</div>
                  <div className="truncate text-xs text-slate-500">{p.email}</div>
                </div>

                {isOwner ? (
                  <span className="shrink-0 rounded-full bg-brand-600 px-2 py-1 text-[10.5px] font-bold uppercase text-white">
                    Owner
                  </span>
                ) : isAdmin ? (
                  <button
                    onClick={() => stepDown(p.id)}
                    disabled={busy === p.id}
                    className="shrink-0 inline-flex items-center gap-1 rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs font-semibold text-slate-600 transition hover:border-rose-300 hover:bg-rose-50 hover:text-rose-700"
                  >
                    <X size={13} />
                    Admin
                  </button>
                ) : (
                  <button
                    onClick={() => appoint(p.id)}
                    disabled={busy === p.id}
                    className="shrink-0 rounded-lg border border-brand-300 bg-brand-50 px-2.5 py-1.5 text-xs font-semibold text-brand-700 transition hover:bg-brand-100"
                  >
                    Make admin
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </Sheet>
  );
}
