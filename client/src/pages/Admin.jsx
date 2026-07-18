import { useEffect, useState } from "react";
import { Building2, CarFront, Leaf, Route, Users } from "lucide-react";
import { get, post, put } from "../lib/api";
import { Avatar, Banner, Spinner, StatusChip, money } from "../components/ui";

const TABS = [
  ["employees", "Employees"],
  ["vehicles", "Vehicles"],
  ["impact", "Impact"],
  ["settings", "Settings"],
];

export default function Admin() {
  const [tab, setTab] = useState("employees");
  const [stats, setStats] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    get("/admin/stats").then(setStats).catch((e) => setError(e.message));
  }, []);

  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="text-xl font-semibold tracking-tight text-slate-900">Admin</h1>
      <p className="mt-1 text-sm text-slate-500">
        Manage people, vehicles and the settings that drive fare calculations.
      </p>

      <Banner>{error}</Banner>

      <div className="mt-4 grid grid-cols-3 gap-3">
        <Stat icon={Users} label="Employees" value={stats?.totalEmployees ?? "—"} />
        <Stat icon={CarFront} label="Vehicles" value={stats?.registeredVehicles ?? "—"} />
        <Stat icon={Route} label="Rides this month" value={stats?.ridesThisMonth ?? "—"} />
      </div>

      <div className="mt-5 flex gap-1 overflow-x-auto rounded-xl2 border border-slate-200 bg-white p-1">
        {TABS.map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`shrink-0 rounded-lg px-3 py-2 text-sm font-medium transition ${
              tab === key ? "bg-brand-600 text-white" : "text-slate-600"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="mt-4">
        {tab === "employees" && <Employees />}
        {tab === "vehicles" && <Vehicles />}
        {tab === "impact" && <Impact />}
        {tab === "settings" && <Settings />}
      </div>
    </div>
  );
}

function Employees() {
  const [rows, setRows] = useState(null);
  const [error, setError] = useState("");

  const load = () => get("/admin/employees").then((d) => setRows(d.employees)).catch((e) => setError(e.message));
  useEffect(() => {
    load();
  }, []);

  const toggle = async (emp) => {
    setError("");
    try {
      await post(`/admin/employees/${emp.id}/access`, { approve: !emp.isApproved });
      await load();
    } catch (err) {
      setError(err.message);
    }
  };

  if (!rows) return <Spinner label="Loading employees" />;

  return (
    <>
      <Banner>{error}</Banner>
      <div className="card divide-y divide-slate-100">
        {rows.map((e) => (
          <div key={e.id} className="flex items-center gap-3 p-4">
            <Avatar name={e.name} color={e.avatarColor} size={38} />

            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="truncate font-medium text-slate-900">{e.name}</span>
                {e.role === "ADMIN" && (
                  <span className="chip bg-slate-100 text-slate-600">Admin</span>
                )}
              </div>
              <div className="truncate text-xs text-slate-500">{e.email}</div>
              <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-slate-500">
                <span>{e.department ?? "No department"}</span>
                <span>{e._count.ridesOffered} offered</span>
                <span>{e._count.bookings} booked</span>
                <span>{e._count.vehicles} vehicles</span>
              </div>
            </div>

            <div className="shrink-0 text-right">
              {e.isApproved ? (
                <StatusChip status="COMPLETED">Active</StatusChip>
              ) : (
                <StatusChip status="CANCELLED">Revoked</StatusChip>
              )}
              {e.role !== "ADMIN" && (
                <button
                  onClick={() => toggle(e)}
                  className="mt-1.5 block text-xs font-medium text-brand-700 hover:underline"
                >
                  {e.isApproved ? "Revoke access" : "Restore access"}
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

function Vehicles() {
  const [rows, setRows] = useState(null);
  const [error, setError] = useState("");

  const load = () => get("/admin/vehicles").then((d) => setRows(d.vehicles)).catch((e) => setError(e.message));
  useEffect(() => {
    load();
  }, []);

  const toggle = async (v) => {
    setError("");
    try {
      await post(`/admin/vehicles/${v.id}/approval`, { approve: !v.isApproved });
      await load();
    } catch (err) {
      setError(err.message);
    }
  };

  if (!rows) return <Spinner label="Loading vehicles" />;

  return (
    <>
      <Banner>{error}</Banner>
      <div className="card divide-y divide-slate-100">
        {rows.map((v) => (
          <div key={v.id} className="flex items-center gap-3 p-4">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500">
              <CarFront size={18} />
            </span>

            <div className="min-w-0 flex-1">
              <div className="truncate font-medium text-slate-900">{v.model}</div>
              <div className="font-mono text-xs tracking-wide text-slate-600">
                {v.registrationNumber}
              </div>
              <div className="mt-0.5 truncate text-[11px] text-slate-500">
                {v.user.name} · {v.seatingCapacity} seats · {v.mileageKmpl} km/l
              </div>
            </div>

            <div className="shrink-0 text-right">
              {v.isApproved ? (
                <StatusChip status="COMPLETED">Approved</StatusChip>
              ) : (
                <StatusChip status="PENDING">Inactive</StatusChip>
              )}
              <button
                onClick={() => toggle(v)}
                className="mt-1.5 block text-xs font-medium text-brand-700 hover:underline"
              >
                {v.isApproved ? "Mark inactive" : "Approve"}
              </button>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

function Impact() {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    get("/reports/org").then(setData).catch((e) => setError(e.message));
  }, []);

  if (error) return <Banner>{error}</Banner>;
  if (!data) return <Spinner label="Calculating impact" />;

  const s = data.summary;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 rounded-xl2 border border-brand-200 bg-brand-50 p-4">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand-600 text-white">
          <Leaf size={20} />
        </span>
        <div>
          <div className="text-lg font-semibold text-brand-900">{s.co2SavedKg} kg CO₂ saved</div>
          <div className="text-xs text-brand-700">
            About {s.treeEquivalent} {s.treeEquivalent === 1 ? "tree" : "trees"} working for a year ·
            {" "}{s.litresSaved} litres of fuel · {money(s.fuelCostSaved)} not spent
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Stat label="Completed rides" value={s.completedRides} />
        <Stat label="Seats shared" value={s.seatsShared} />
        <Stat label="Shared distance" value={`${Math.round(s.sharedPassengerKm)} km`} />
      </div>

      <div className="card p-4">
        <h2 className="mb-3 text-[15px] font-semibold text-slate-900">Most used routes</h2>
        <div className="space-y-2">
          {data.topRoutes.map((r) => (
            <div key={r.route} className="flex items-center justify-between text-sm">
              <span className="min-w-0 truncate text-slate-700">{r.route}</span>
              <span className="shrink-0 text-slate-500">{r.trips} trips</span>
            </div>
          ))}
        </div>
      </div>

      <div className="card p-4">
        <h2 className="mb-3 text-[15px] font-semibold text-slate-900">Most active people</h2>
        <div className="space-y-3">
          {data.leaderboard.map((p, i) => (
            <div key={p.id} className="flex items-center gap-3">
              <span className="w-4 shrink-0 text-sm font-medium text-slate-400">{i + 1}</span>
              <Avatar name={p.name} color={p.avatarColor} size={30} />
              <span className="min-w-0 flex-1 truncate text-sm text-slate-800">{p.name}</span>
              <span className="shrink-0 text-xs text-slate-500">
                {p.drove} driving · {p.rode} riding
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="card p-4">
        <h2 className="mb-3 text-[15px] font-semibold text-slate-900">By department</h2>
        <div className="space-y-2">
          {data.byDepartment.map((d) => (
            <div key={d.department} className="flex items-center justify-between text-sm">
              <span className="text-slate-700">{d.department}</span>
              <span className="text-slate-500">
                {d.trips} trips · {Math.round(d.km)} km
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Settings() {
  const [org, setOrg] = useState(null);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    get("/admin/settings").then((d) => setOrg(d.org)).catch((e) => setError(e.message));
  }, []);

  const set = (k) => (e) => setOrg({ ...org, [k]: e.target.value });

  const save = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    setSaved(false);

    try {
      const { org: updated } = await put("/admin/settings", {
        name: org.name,
        registeredAddress: org.registeredAddress ?? "",
        industry: org.industry ?? "",
        adminContact: org.adminContact ?? "",
        fuelPricePerLitre: Number(org.fuelPricePerLitre),
        costPerKm: Number(org.costPerKm),
        travelCostPerKm: Number(org.travelCostPerKm),
      });
      setOrg(updated);
      setSaved(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  if (!org) return error ? <Banner>{error}</Banner> : <Spinner label="Loading settings" />;

  return (
    <form onSubmit={save} className="space-y-4">
      <div className="card p-4">
        <h2 className="mb-3 flex items-center gap-2 text-[15px] font-semibold text-slate-900">
          <Building2 size={16} className="text-slate-400" />
          Company details
        </h2>

        <div className="space-y-3">
          <div>
            <label className="label">Company name</label>
            <input className="field" value={org.name} onChange={set("name")} />
          </div>
          <div>
            <label className="label">Registered address</label>
            <input
              className="field"
              value={org.registeredAddress ?? ""}
              onChange={set("registeredAddress")}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Industry</label>
              <input className="field" value={org.industry ?? ""} onChange={set("industry")} />
            </div>
            <div>
              <label className="label">Admin contact</label>
              <input
                className="field"
                value={org.adminContact ?? ""}
                onChange={set("adminContact")}
              />
            </div>
          </div>
          <div>
            <label className="label">Email domain</label>
            <input className="field bg-slate-50 text-slate-500" value={org.domain} disabled />
            <p className="mt-1 text-xs text-slate-500">
              Employees with this domain can register. Changing it is not supported.
            </p>
          </div>
        </div>
      </div>

      <div className="card p-4">
        <h2 className="mb-1 text-[15px] font-semibold text-slate-900">Carpooling configuration</h2>
        <p className="mb-3 text-xs text-slate-500">
          These values decide the fare suggested to drivers when they publish a ride.
        </p>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div>
            <label className="label">Fuel price (₹/litre)</label>
            <input
              type="number"
              step="0.01"
              className="field"
              value={org.fuelPricePerLitre}
              onChange={set("fuelPricePerLitre")}
            />
          </div>
          <div>
            <label className="label">Cost per km (₹)</label>
            <input
              type="number"
              step="0.01"
              className="field"
              value={org.costPerKm}
              onChange={set("costPerKm")}
            />
          </div>
          <div>
            <label className="label">Upkeep per km (₹)</label>
            <input
              type="number"
              step="0.01"
              className="field"
              value={org.travelCostPerKm}
              onChange={set("travelCostPerKm")}
            />
          </div>
        </div>
      </div>

      <Banner>{error}</Banner>
      {saved && <Banner kind="success">Settings saved.</Banner>}

      <button className="btn-primary w-full sm:w-auto" disabled={busy}>
        {busy ? "Saving" : "Save settings"}
      </button>
    </form>
  );
}

function Stat({ icon: Icon, label, value }) {
  return (
    <div className="card px-4 py-3">
      <div className="flex items-center gap-1.5 text-[12px] text-slate-500">
        {Icon && <Icon size={13} />}
        {label}
      </div>
      <div className="mt-0.5 text-xl font-semibold text-slate-900">{value}</div>
    </div>
  );
}
