import { useEffect, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Building2,
  CarFront,
  Leaf,
  Route,
  ShieldAlert,
  ShieldCheck,
  Star,
  UserPlus,
  Users,
} from "lucide-react";
import { get, post, put } from "../lib/api";
import { useAuth } from "../lib/auth";
import { filterName, filterPhone } from "../lib/inputs";
import { Avatar, Banner, Sheet, Spinner, StatusChip, money, when } from "../components/ui";

// Same validated accent and recessive chrome as the personal report, so the
// two dashboards read as one product.
const ACCENT = "#059669";
const GRID = "#eef2f6";
const AXIS_TEXT = "#94a3b8";
const TOOLTIP = {
  borderRadius: 10,
  border: "1px solid #e2e8f0",
  boxShadow: "0 8px 24px -8px rgba(16,24,40,.12)",
  fontSize: 12,
  padding: "8px 10px",
};

const TABS = [
  ["employees", "Employees"],
  ["vehicles", "Vehicles"],
  ["safety", "Safety"],
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
        {tab === "safety" && <Safety />}
        {tab === "impact" && <Impact />}
        {tab === "settings" && <Settings />}
      </div>
    </div>
  );
}

const BLANK_EMPLOYEE = {
  name: "",
  localPart: "",
  password: "",
  phone: "",
  department: "",
  employeeCode: "",
  gender: "",
};

function Employees() {
  const { org } = useAuth();
  const [rows, setRows] = useState(null);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(BLANK_EMPLOYEE);
  const [formError, setFormError] = useState("");
  const [busy, setBusy] = useState(false);
  const [created, setCreated] = useState(null);

  const load = () => get("/admin/employees").then((d) => setRows(d.employees)).catch((e) => setError(e.message));
  useEffect(() => {
    load();
  }, []);

  const addEmployee = async (e) => {
    e.preventDefault();
    setBusy(true);
    setFormError("");
    try {
      // The admin types the name in front of the @; the domain is the
      // organisation's own and is not theirs to choose, because it is what
      // decides which company the account belongs to.
      const email = `${form.localPart.trim().toLowerCase()}@${org.domain}`;
      const { employee } = await post("/admin/employees", {
        name: form.name.trim(),
        email,
        password: form.password,
        phone: form.phone.trim() || undefined,
        department: form.department.trim() || undefined,
        employeeCode: form.employeeCode.trim() || undefined,
        gender: form.gender || undefined,
      });
      await load();
      setShowForm(false);
      setForm(BLANK_EMPLOYEE);
      // Held on screen afterwards: the admin has just chosen a password on
      // somebody else's behalf and has one chance to pass it on.
      setCreated({ ...employee, password: form.password });
    } catch (err) {
      setFormError(err.message);
    } finally {
      setBusy(false);
    }
  };

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
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="text-sm text-slate-500">
          {rows.length} {rows.length === 1 ? "person" : "people"} at {org?.name}
        </p>
        <button onClick={() => setShowForm(true)} className="btn-primary btn-sm shrink-0">
          <UserPlus size={15} />
          Add employee
        </button>
      </div>

      <Banner>{error}</Banner>

      {/* Shown once, straight after creating the account. The admin picked this
          password for someone else and cannot look it up again afterwards. */}
      {created && (
        <div className="card mb-3 border-brand-200 bg-brand-50 p-4">
          <p className="text-sm font-semibold text-brand-900">{created.name} can now sign in</p>
          <dl className="mt-2 space-y-1 text-sm text-brand-800">
            <div className="flex gap-2">
              <dt className="w-20 shrink-0 text-brand-700">Work email</dt>
              <dd className="font-mono">{created.email}</dd>
            </div>
            <div className="flex gap-2">
              <dt className="w-20 shrink-0 text-brand-700">Password</dt>
              <dd className="font-mono">{created.password}</dd>
            </div>
          </dl>
          <p className="mt-2 text-xs text-brand-700">
            Pass these on now — the password is not stored anywhere you can read it back.
          </p>
          <button onClick={() => setCreated(null)} className="btn-secondary btn-sm mt-3">
            Done
          </button>
        </div>
      )}

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

      <Sheet open={showForm} onClose={() => !busy && setShowForm(false)} title="Add an employee">
        <form onSubmit={addEmployee} className="space-y-4">
          <div>
            <label className="label">Full name</label>
            <input
              className="field"
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: filterName(e.target.value) })}
              placeholder="Ananya Desai"
            />
          </div>

          <div>
            <label className="label">Work email</label>
            {/* The domain is fixed and shown, not typed. It decides which
                organisation the account belongs to, so it is the one part of
                the address an administrator must not be able to get wrong. */}
            {/* min-w-0 on the input: `.field` is w-full, which otherwise
                crushes the domain beside it down to just the "@". */}
            <div className="flex items-stretch">
              <input
                className="field min-w-0 flex-1 rounded-r-none border-r-0 lowercase"
                required
                value={form.localPart}
                onChange={(e) =>
                  setForm({ ...form, localPart: e.target.value.replace(/[^a-zA-Z0-9._-]/g, "") })
                }
                placeholder="ananya"
              />
              <span className="flex shrink-0 items-center rounded-r-xl border border-l-0 border-slate-200 bg-slate-100 px-3 text-[15px] font-medium text-slate-600">
                @{org?.domain}
              </span>
            </div>
            <p className="mt-1 text-xs text-slate-500">
              Everyone at {org?.name} signs in with this domain.
            </p>
          </div>

          <div>
            <label className="label">Temporary password</label>
            <input
              className="field"
              required
              minLength={6}
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              placeholder="At least 6 characters"
            />
            <p className="mt-1 text-xs text-slate-500">
              Shown to you once after you save, so you can pass it on.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Department</label>
              <input
                className="field"
                value={form.department}
                onChange={(e) => setForm({ ...form, department: e.target.value })}
                placeholder="Engineering"
              />
            </div>
            <div>
              <label className="label">Employee code</label>
              <input
                className="field"
                value={form.employeeCode}
                onChange={(e) => setForm({ ...form, employeeCode: e.target.value })}
                placeholder="NB008"
              />
            </div>
          </div>

          <div>
            <label className="label">Mobile number</label>
            <input
              className="field"
              type="tel"
              inputMode="tel"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: filterPhone(e.target.value) })}
              placeholder="+91 98765 43210"
            />
          </div>

          <div>
            <label className="label">
              Gender <span className="font-medium normal-case text-slate-400">(optional)</span>
            </label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { value: "FEMALE", label: "Female" },
                { value: "MALE", label: "Male" },
                { value: "UNDISCLOSED", label: "Prefer not to say" },
              ].map((c) => (
                <button
                  key={c.value}
                  type="button"
                  onClick={() => setForm({ ...form, gender: c.value })}
                  className={`min-h-[42px] rounded-xl border px-2 text-[12.5px] font-semibold leading-tight transition ${
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
              Only used to match women-only rides. They can change it themselves later.
            </p>
          </div>

          <Banner>{formError}</Banner>

          <button className="btn-primary w-full" disabled={busy}>
            {busy ? "Creating…" : "Create employee"}
          </button>
        </form>
      </Sheet>
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

/**
 * Live SOS alerts, then the safety numbers behind them.
 *
 * Alerts come first and unresolved ones are pinned to the top: this is the one
 * screen in the product that might be open while something is actually going
 * wrong, and an administrator should not have to scroll past a chart to find
 * out who needs help.
 */
function Safety() {
  const [data, setData] = useState(null);
  const [report, setReport] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(null);

  const load = () =>
    Promise.all([get("/sos"), get("/reports/safety")])
      .then(([alerts, safety]) => {
        setData(alerts);
        setReport(safety);
      })
      .catch((e) => setError(e.message));

  // Polled, like the rest of the product's realtime. An alert raised while
  // this tab is open should appear without anyone thinking to refresh.
  useEffect(() => {
    load();
    const timer = setInterval(load, 15000);
    return () => clearInterval(timer);
  }, []);

  const resolve = async (id) => {
    setBusy(id);
    try {
      await post(`/sos/${id}/resolve`, {});
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(null);
    }
  };

  if (error) return <Banner>{error}</Banner>;
  if (!data || !report) return <Spinner label="Loading safety" />;

  const { summary, sos, ratings } = report;

  return (
    <div className="space-y-5">
      {data.activeCount > 0 && (
        <div className="rounded-2xl border-2 border-rose-300 bg-rose-50 p-4">
          <div className="flex items-center gap-2 text-rose-800">
            <ShieldAlert size={18} />
            <span className="font-bold">
              {data.activeCount} active {data.activeCount === 1 ? "alert" : "alerts"}
            </span>
          </div>
          <p className="mt-1 text-sm text-rose-700">
            Someone has raised an emergency and nobody has marked it handled yet.
          </p>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat icon={ShieldCheck} label="Women-only trips" value={summary.womenOnlyRides} />
        <Stat icon={Users} label="Women travelling" value={`${summary.womenParticipation}%`} />
        <Stat icon={ShieldAlert} label="SOS raised" value={sos.total} />
        <Stat
          icon={Star}
          label="Average rating"
          value={ratings.average ? ratings.average.toFixed(2) : "—"}
        />
      </div>

      <section className="card p-4">
        <h2 className="text-[15px] font-semibold text-slate-900">Emergency alerts</h2>
        <p className="mt-0.5 text-xs text-slate-500">
          {sos.averageResponseMinutes != null
            ? `Handled in ${sos.averageResponseMinutes} minutes on average.`
            : "Nothing has been resolved yet."}
        </p>

        {data.alerts.length === 0 ? (
          <p className="mt-4 rounded-xl bg-slate-50 p-4 text-center text-sm text-slate-500">
            No alerts have ever been raised.
          </p>
        ) : (
          <ul className="mt-3 divide-y divide-slate-100">
            {data.alerts.map((a) => (
              <li key={a.id} className="py-3">
                <div className="flex items-start gap-3">
                  <Avatar name={a.user.name} color={a.user.avatarColor} size={36} />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium text-slate-900">{a.user.name}</span>
                      <span
                        className={`chip ${
                          a.status === "ACTIVE"
                            ? "border border-rose-200 bg-rose-50 text-rose-700"
                            : "border border-slate-200 bg-slate-50 text-slate-600"
                        }`}
                      >
                        {a.status === "ACTIVE" ? "Active" : "Resolved"}
                      </span>
                      <span className="text-xs text-slate-400">{when(a.createdAt)}</span>
                    </div>

                    {a.note && <p className="mt-1 text-sm text-slate-700">“{a.note}”</p>}

                    <div className="mt-1 space-y-0.5 text-xs text-slate-500">
                      {a.ride && (
                        <div>
                          Trip: {a.ride.originLabel} to {a.ride.destLabel}
                          {a.ride.vehicle && ` · ${a.ride.vehicle.registrationNumber}`}
                        </div>
                      )}
                      <div className="flex flex-wrap items-center gap-x-3">
                        {a.user.phone && (
                          <a href={`tel:${a.user.phone}`} className="font-medium text-brand-700">
                            Call {a.user.phone}
                          </a>
                        )}
                        {a.user.emergencyContactPhone && (
                          <a
                            href={`tel:${a.user.emergencyContactPhone}`}
                            className="font-medium text-rose-700"
                          >
                            {a.user.emergencyContactName || "Emergency contact"}:{" "}
                            {a.user.emergencyContactPhone}
                          </a>
                        )}
                        {a.lat != null && a.lng != null ? (
                          <a
                            href={`https://www.openstreetmap.org/?mlat=${a.lat}&mlon=${a.lng}#map=17/${a.lat}/${a.lng}`}
                            target="_blank"
                            rel="noreferrer"
                            className="font-medium text-brand-700"
                          >
                            Open location
                          </a>
                        ) : (
                          <span>No location was available</span>
                        )}
                      </div>
                      {a.status === "RESOLVED" && a.resolvedBy && (
                        <div>Handled by {a.resolvedBy}</div>
                      )}
                    </div>
                  </div>

                  {a.status === "ACTIVE" && (
                    <button
                      onClick={() => resolve(a.id)}
                      disabled={busy === a.id}
                      className="btn-secondary btn-sm shrink-0"
                    >
                      {busy === a.id ? "Saving" : "Mark handled"}
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="card p-4">
        <h2 className="text-[15px] font-semibold text-slate-900">Women-only travel</h2>
        <p className="mt-0.5 text-xs text-slate-500">
          {summary.womenOnlyRides} of the organisation's trips ran women-only, carrying{" "}
          {summary.womenOnlySeats} {summary.womenOnlySeats === 1 ? "passenger" : "passengers"}.
        </p>

        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <Figure
            label="Share of all trips"
            value={`${summary.womenOnlyShare}%`}
            hint={`${summary.womenOnlyCompleted} completed`}
          />
          <Figure
            label="Emergency contacts on file"
            value={`${summary.emergencyContactsOnFile}/${summary.peopleTotal}`}
            hint="People reachable in an emergency"
          />
        </div>

        {report.byDepartment.length > 0 && (
          <table className="mt-4 w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-400">
                <th className="pb-2 font-semibold">Department</th>
                <th className="pb-2 text-right font-semibold">People</th>
                <th className="pb-2 text-right font-semibold">Women</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {report.byDepartment.map((d) => (
                <tr key={d.department}>
                  <td className="py-2.5 text-slate-700">{d.department}</td>
                  <td className="py-2.5 text-right tabular-nums text-slate-600">{d.people}</td>
                  <td className="py-2.5 text-right tabular-nums font-medium text-violet-700">
                    {d.women}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="card p-4">
        <h2 className="text-[15px] font-semibold text-slate-900">Driver ratings</h2>
        <p className="mt-0.5 text-xs text-slate-500">
          {ratings.count} ratings, averaging {ratings.average ?? "—"}.{" "}
          {ratings.lowRatings > 0
            ? `${ratings.lowRatings} at two stars or below.`
            : "None at two stars or below."}
        </p>

        {ratings.trend.length > 1 && (
          <ResponsiveContainer width="100%" height={180} className="mt-3">
            <LineChart data={ratings.trend} margin={{ top: 8, right: 12, bottom: 0, left: -22 }}>
              <CartesianGrid stroke="#eef2f5" vertical={false} />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#94a3b8" }} tickLine={false} axisLine={false} />
              <YAxis domain={[0, 5]} tick={{ fontSize: 11, fill: "#94a3b8" }} tickLine={false} axisLine={false} />
              <Tooltip
                contentStyle={{ fontSize: 12, borderRadius: 10, border: "1px solid #e2e8f0" }}
                formatter={(v) => [`${v} stars`, "Average"]}
              />
              <Line type="monotone" dataKey="average" stroke="#059669" strokeWidth={2.5} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        )}
      </section>
    </div>
  );
}

function Figure({ label, value, hint }) {
  return (
    <div className="rounded-xl border border-slate-200 p-3">
      <div className="text-xs text-slate-500">{label}</div>
      <div className="mt-0.5 text-xl font-semibold text-slate-900">{value}</div>
      {hint && <div className="text-xs text-slate-400">{hint}</div>}
    </div>
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

      <div className="card p-5">
        <h2 className="mb-1 text-[15px] font-semibold text-slate-900">Most used routes</h2>
        <p className="mb-4 text-xs text-slate-500">Completed trips per corridor</p>

        {/* One series, so one colour for every bar and no legend — the title
            already says what is plotted. */}
        <ResponsiveContainer width="100%" height={Math.max(110, data.topRoutes.length * 40 + 24)}>
          <BarChart
            data={data.topRoutes}
            layout="vertical"
            margin={{ top: 0, right: 40, left: 0, bottom: 0 }}
          >
            <CartesianGrid stroke={GRID} horizontal={false} />
            <XAxis type="number" tickLine={false} axisLine={false} tick={{ fill: AXIS_TEXT, fontSize: 11 }} allowDecimals={false} />
            <YAxis
              type="category"
              dataKey="route"
              width={168}
              tickLine={false}
              axisLine={false}
              tick={{ fill: "#475569", fontSize: 11 }}
            />
            <Tooltip cursor={{ fill: "rgba(5,150,105,0.05)" }} contentStyle={TOOLTIP} formatter={(v) => [`${v} trips`, "Trips"]} />
            <Bar isAnimationActive={false}
              dataKey="trips"
              fill={ACCENT}
              radius={[0, 4, 4, 0]}
              barSize={16}
              label={{ position: "right", fill: "#475569", fontSize: 11 }}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="card p-5">
        <h2 className="mb-1 text-[15px] font-semibold text-slate-900">Participation by department</h2>
        <p className="mb-4 text-xs text-slate-500">Trips taken or given, per team</p>

        <ResponsiveContainer width="100%" height={Math.max(110, data.byDepartment.length * 40 + 24)}>
          <BarChart
            data={data.byDepartment}
            layout="vertical"
            margin={{ top: 0, right: 40, left: 0, bottom: 0 }}
          >
            <CartesianGrid stroke={GRID} horizontal={false} />
            <XAxis type="number" tickLine={false} axisLine={false} tick={{ fill: AXIS_TEXT, fontSize: 11 }} allowDecimals={false} />
            <YAxis
              type="category"
              dataKey="department"
              width={110}
              tickLine={false}
              axisLine={false}
              tick={{ fill: "#475569", fontSize: 11 }}
            />
            <Tooltip cursor={{ fill: "rgba(5,150,105,0.05)" }} contentStyle={TOOLTIP} formatter={(v) => [`${v} trips`, "Trips"]} />
            <Bar isAnimationActive={false}
              dataKey="trips"
              fill={ACCENT}
              radius={[0, 4, 4, 0]}
              barSize={16}
              label={{ position: "right", fill: "#475569", fontSize: 11 }}
            />
          </BarChart>
        </ResponsiveContainer>
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

      {/* The table view for the charts above: every plotted value in text. */}
      <div className="card p-5">
        <h2 className="mb-3 text-[15px] font-semibold text-slate-900">Department detail</h2>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left text-[11px] uppercase tracking-wide text-slate-400">
              <th className="pb-2 font-semibold">Department</th>
              <th className="pb-2 text-right font-semibold">Trips</th>
              <th className="pb-2 text-right font-semibold">Distance</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {data.byDepartment.map((d) => (
              <tr key={d.department}>
                <td className="py-2.5 text-slate-700">{d.department}</td>
                <td className="py-2.5 text-right tabular-nums text-slate-600">{d.trips}</td>
                <td className="py-2.5 text-right tabular-nums text-slate-600">
                  {Math.round(d.km)} km
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Settings() {
  const [org, setOrg] = useState(null);
  const [stats, setStats] = useState(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    get("/admin/settings")
      .then((d) => {
        setOrg(d.org);
        setStats(d.stats);
      })
      .catch((e) => setError(e.message));
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
      {/* The organisation at a glance. An administrator arriving here is asking
          two questions — "what is my company set up as" and "how do my people
          get in" — so both are answered before any editable field appears. */}
      <div className="overflow-hidden rounded-xl2 border border-slate-200 bg-white shadow-sm">
        <div className="bg-gradient-to-br from-brand-600 to-brand-700 px-5 py-4 text-white">
          <div className="flex items-start gap-3.5">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white/15 text-lg font-bold backdrop-blur">
              {(org.name ?? "?").slice(0, 2).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="truncate text-lg font-bold leading-tight">{org.name}</h2>
              <p className="mt-0.5 truncate text-[13px] text-white/80">
                {org.industry || "Industry not set"}
                {org.registeredAddress ? ` · ${org.registeredAddress}` : ""}
              </p>
            </div>
            <span className="hidden shrink-0 rounded-full bg-white/15 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide backdrop-blur sm:block">
              Active
            </span>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {[
              ["Employees", stats?.employees],
              ["Administrators", stats?.admins],
              ["Rides published", stats?.rides],
              ["Pending access", stats?.pendingAccess],
            ].map(([label, value]) => (
              <div key={label} className="rounded-lg bg-white/10 px-3 py-2 backdrop-blur">
                <div className="text-[19px] font-bold leading-none">{value ?? "—"}</div>
                <div className="mt-1 text-[11px] font-medium text-white/75">{label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* How people join, stated plainly — this is the question every new
            administrator asks first, and the answer is not a setting they can
            change, so it belongs here rather than beside an input. */}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-slate-200 bg-slate-50 px-5 py-3">
          <div className="min-w-0 flex-1">
            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
              How your team joins
            </div>
            <p className="mt-0.5 text-[13px] text-slate-600">
              Anyone with an{" "}
              <span className="rounded bg-white px-1.5 py-0.5 font-mono text-[12.5px] font-semibold text-brand-700 ring-1 ring-slate-200">
                @{org.domain}
              </span>{" "}
              address can sign up and joins {org.name} automatically. No invite codes.
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              navigator.clipboard?.writeText(`${window.location.origin}/signup`);
              setCopied(true);
              setTimeout(() => setCopied(false), 2000);
            }}
            className="shrink-0 rounded-lg border border-slate-300 bg-white px-3 py-2 text-[13px] font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            {copied ? "Link copied" : "Copy sign-up link"}
          </button>
        </div>
      </div>

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
