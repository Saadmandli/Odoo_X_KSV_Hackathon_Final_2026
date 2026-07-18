import { useEffect, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Download, Fuel, Route, TrendingUp, Wallet } from "lucide-react";
import { get } from "../lib/api";
import { Banner, EmptyState, Spinner, money } from "../components/ui";

// Every colour here was checked with the palette validator against a light
// surface, not chosen by eye.
const ACCENT = "#059669";

// Diverging pair for above/below a baseline. Warm against cool, so the two
// poles read as opposites; zero is the neutral midpoint.
const POSITIVE = "#059669";
const NEGATIVE = "#e11d48";

// Two steps of one hue for a part-to-whole stack.
const FUEL = "#047857";
const UPKEEP = "#10b981";

const GRID = "#eef2f6";
const AXIS_TEXT = "#94a3b8";

export default function Reports() {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    get("/reports").then(setData).catch((e) => setError(e.message));
  }, []);

  if (error) return <Banner>{error}</Banner>;
  if (!data) return <Spinner label="Building your report" />;

  const s = data.summary;

  if (s.totalTrips === 0) {
    return (
      <div className="mx-auto max-w-3xl">
        <Header />
        <div className="mt-6">
          <EmptyState
            icon={TrendingUp}
            title="No completed trips yet"
            hint="Your fuel, cost and efficiency figures appear here once you have finished a trip."
          />
        </div>
      </div>
    );
  }

  const trend = data.fuelEfficiencyTrend;
  const vehicles = data.vehicleCosts.slice(0, 5);

  return (
    <div className="mx-auto max-w-3xl">
      <Header onExport={() => exportCsv(data)} />

      {/* Hero figure — the one number this view leads with. */}
      <section className="mt-6 rounded-2xl border border-brand-200 bg-gradient-to-br from-brand-50 to-white p-6">
        <p className="text-[13px] font-medium text-brand-800">Carbon not emitted</p>
        <p className="mt-1 text-[52px] font-semibold leading-none tracking-tight text-brand-900">
          {s.co2SavedKg}
          <span className="ml-2 text-2xl font-medium text-brand-700">kg</span>
        </p>
        <p className="mt-2 max-w-md text-sm text-slate-600">
          {s.seatsShared > 0
            ? `${s.seatsShared} seat${s.seatsShared === 1 ? "" : "s"} shared over ${Math.round(s.sharedKm)} km — journeys that would otherwise have been driven separately.`
            : `Across ${Math.round(s.sharedKm)} km of shared travel.`}
        </p>
      </section>

      {/* Supporting figures. Stat tiles, not a chart — these are single values. */}
      <section className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat icon={Route} label="Trips completed" value={s.totalTrips} sub={`${s.tripsAsDriver} driving`} />
        <Stat icon={Route} label="Distance shared" value={`${Math.round(s.totalDistanceKm)} km`} />
        <Stat icon={Fuel} label="Fuel used" value={`${s.fuelConsumedLitres} L`} sub={money(s.fuelCost)} />
        <Stat icon={Wallet} label="Cost per km" value={money(s.costPerKm)} />
      </section>

      <section className="mt-3 grid grid-cols-2 gap-3">
        <Stat label="Earned as driver" value={money(s.totalEarned)} accent />
        <Stat label="Spent as rider" value={money(s.totalSpent)} />
      </section>

      {trend.length > 1 && (
        <Panel title="Fuel efficiency" sub="Kilometres per litre, by month">
          {/* Height includes the axis band so the labels are never cut off. */}
          <ResponsiveContainer width="100%" height={210}>
            <LineChart data={trend} margin={{ top: 16, right: 32, left: 0, bottom: 4 }}>
              <CartesianGrid stroke={GRID} vertical={false} />
              <XAxis
                dataKey="month"
                tickLine={false}
                axisLine={{ stroke: GRID }}
                tick={{ fill: AXIS_TEXT, fontSize: 11 }}
                dy={4}
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                tick={{ fill: AXIS_TEXT, fontSize: 11 }}
                width={36}
              />
              <Tooltip
                cursor={{ stroke: GRID }}
                contentStyle={TOOLTIP}
                labelStyle={{ color: "#0f172a", fontWeight: 600, marginBottom: 2 }}
                formatter={(v) => [`${v} km/l`, "Efficiency"]}
              />
              <Line
                type="monotone"
                dataKey="efficiencyKmpl"
                stroke={ACCENT}
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
                dot={false}
                // Only the final point is marked, with a surface ring so it
                // stays legible where it crosses the line.
                activeDot={{ r: 5, fill: ACCENT, stroke: "#fff", strokeWidth: 2 }}
              >
                <LastPointLabel />
              </Line>
            </LineChart>
          </ResponsiveContainer>
        </Panel>
      )}

      {data.monthlySummary.length > 1 && (
        <Panel
          title="Net result by month"
          sub="Fares received against what the trips cost to run"
        >
          {/* Above/below a baseline is the diverging job: one hue each side of
              zero, with the zero line drawn so the sign is unmistakable. */}
          <ResponsiveContainer width="100%" height={210}>
            <BarChart data={data.monthlySummary} margin={{ top: 8, right: 8, left: 0, bottom: 4 }}>
              <CartesianGrid stroke={GRID} vertical={false} />
              <XAxis
                dataKey="month"
                tickLine={false}
                axisLine={false}
                tick={{ fill: AXIS_TEXT, fontSize: 11 }}
                dy={4}
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                tick={{ fill: AXIS_TEXT, fontSize: 11 }}
                width={48}
                tickFormatter={(v) => `₹${v}`}
              />
              <Tooltip
                cursor={{ fill: "rgba(5,150,105,0.05)" }}
                contentStyle={TOOLTIP}
                formatter={(v) => [money(v), v >= 0 ? "Profit" : "Loss"]}
              />
              <ReferenceLine y={0} stroke="#cbd5e1" />
              <Bar dataKey="netProfit" radius={[4, 4, 0, 0]} barSize={22} isAnimationActive={false}>
                {data.monthlySummary.map((m) => (
                  <Cell key={m.month} fill={m.netProfit >= 0 ? POSITIVE : NEGATIVE} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>

          <p className="mt-3 text-xs text-slate-500">
            A negative month means fuel and upkeep outweighed the fares collected.
          </p>
        </Panel>
      )}

      {data.monthlySummary.length > 1 && (
        <Panel title="What the trips cost" sub="Fuel and upkeep, by month">
          {/* Part-to-whole over time: stacked, two steps of one hue, with a 2px
              surface gap so the segments separate without a border. */}
          <ResponsiveContainer width="100%" height={230}>
            <BarChart data={data.monthlySummary} margin={{ top: 8, right: 8, left: 0, bottom: 4 }}>
              <CartesianGrid stroke={GRID} vertical={false} />
              <XAxis
                dataKey="month"
                tickLine={false}
                axisLine={false}
                tick={{ fill: AXIS_TEXT, fontSize: 11 }}
                dy={4}
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                tick={{ fill: AXIS_TEXT, fontSize: 11 }}
                width={48}
                tickFormatter={(v) => `₹${v}`}
              />
              <Tooltip cursor={{ fill: "rgba(5,150,105,0.05)" }} contentStyle={TOOLTIP} formatter={(v) => money(v)} />
              <Legend
                iconType="circle"
                iconSize={8}
                wrapperStyle={{ fontSize: 12, color: "#475569", paddingTop: 8 }}
              />
              <Bar dataKey="fuelCost" name="Fuel" stackId="cost" fill={FUEL} barSize={22} isAnimationActive={false} />
              <Bar isAnimationActive={false}
                dataKey="maintenance"
                name="Upkeep"
                stackId="cost"
                fill={UPKEEP}
                barSize={22}
                radius={[4, 4, 0, 0]}
                // The surface-coloured gap is what separates the segments.
                stroke="#fff"
                strokeWidth={2}
              />
            </BarChart>
          </ResponsiveContainer>
        </Panel>
      )}

      {/* A chart needs something to compare. With one vehicle the bar says
          nothing the figure below it doesn't already say, so only the list
          renders. */}
      {vehicles.length >= 2 && (
        <Panel title="Fuel cost by vehicle" sub="Across your completed trips">
          <ResponsiveContainer width="100%" height={Math.max(120, vehicles.length * 46 + 28)}>
            <BarChart data={vehicles} layout="vertical" margin={{ top: 4, right: 56, left: 0, bottom: 4 }}>
              <CartesianGrid stroke={GRID} horizontal={false} />
              <XAxis
                type="number"
                tickLine={false}
                axisLine={false}
                tick={{ fill: AXIS_TEXT, fontSize: 11 }}
                tickFormatter={(v) => `₹${v}`}
              />
              <YAxis
                type="category"
                dataKey="label"
                width={132}
                tickLine={false}
                axisLine={false}
                tick={{ fill: "#475569", fontSize: 11 }}
              />
              <Tooltip
                cursor={{ fill: "rgba(5,150,105,0.05)" }}
                contentStyle={TOOLTIP}
                formatter={(v) => [money(v), "Fuel cost"]}
              />
              {/* One series, so one colour for every bar. Shading bars by size
                  would encode length twice and say nothing new. */}
              <Bar isAnimationActive={false}
                dataKey="fuelCost"
                fill={ACCENT}
                radius={[0, 4, 4, 0]}
                barSize={18}
                label={{
                  position: "right",
                  formatter: (v) => money(v),
                  fill: "#475569",
                  fontSize: 11,
                }}
              />
            </BarChart>
          </ResponsiveContainer>

          <VehicleList vehicles={data.vehicleCosts} bordered />
        </Panel>
      )}

      {vehicles.length === 1 && (
        <Panel title="Vehicle running cost" sub="Across your completed trips">
          <VehicleList vehicles={data.vehicleCosts} />
        </Panel>
      )}

      {data.monthlySummary.length > 0 && (
        <Panel title="Monthly summary" sub="Revenue against running costs">
          {/* The table view: every number above is reachable here in text. */}
          <div className="divide-y divide-slate-100 sm:hidden">
            {data.monthlySummary.map((m) => (
              <div key={m.month} className="py-3 first:pt-0 last:pb-0">
                <div className="flex items-baseline justify-between">
                  <span className="text-[15px] font-medium text-slate-900">{m.month}</span>
                  <span
                    className={`text-[15px] font-semibold tabular-nums ${
                      m.netProfit >= 0 ? "text-brand-700" : "text-rose-600"
                    }`}
                  >
                    {money(m.netProfit)}
                  </span>
                </div>
                <dl className="mt-1.5 grid grid-cols-3 gap-2 text-xs">
                  {[["Revenue", m.revenue], ["Fuel", m.fuelCost], ["Upkeep", m.maintenance]].map(
                    ([label, value]) => (
                      <div key={label}>
                        <dt className="text-slate-500">{label}</dt>
                        <dd className="tabular-nums text-slate-700">{money(value)}</dd>
                      </div>
                    )
                  )}
                </dl>
              </div>
            ))}
          </div>

          <table className="hidden w-full text-sm sm:table">
            <thead>
              <tr className="border-b border-slate-200 text-left text-[11px] uppercase tracking-wide text-slate-400">
                <th className="pb-2 font-semibold">Month</th>
                <th className="pb-2 text-right font-semibold">Revenue</th>
                <th className="pb-2 text-right font-semibold">Fuel</th>
                <th className="pb-2 text-right font-semibold">Upkeep</th>
                <th className="pb-2 text-right font-semibold">Net</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.monthlySummary.map((m) => (
                <tr key={m.month}>
                  <td className="py-2.5 text-slate-700">{m.month}</td>
                  <td className="py-2.5 text-right tabular-nums text-slate-600">{money(m.revenue)}</td>
                  <td className="py-2.5 text-right tabular-nums text-slate-600">{money(m.fuelCost)}</td>
                  <td className="py-2.5 text-right tabular-nums text-slate-600">{money(m.maintenance)}</td>
                  <td
                    className={`py-2.5 text-right font-medium tabular-nums ${
                      m.netProfit >= 0 ? "text-brand-700" : "text-rose-600"
                    }`}
                  >
                    {money(m.netProfit)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>
      )}
    </div>
  );
}

function Header({ onExport }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-slate-900">Reports</h1>
        <p className="mt-1 text-sm text-slate-500">
          Calculated from your completed trips and your organisation's fuel price.
        </p>
      </div>
      {onExport && (
        <button onClick={onExport} className="btn-secondary btn-sm shrink-0">
          <Download size={14} />
          Export CSV
        </button>
      )}
    </div>
  );
}

/**
 * Writes the monthly figures out as CSV.
 *
 * Built and downloaded in the browser: the numbers are already on this page,
 * so a round trip to the server would only add a way for it to fail.
 */
function exportCsv(data) {
  const rows = [
    ["Month", "Revenue", "Fuel cost", "Upkeep", "Net"],
    ...data.monthlySummary.map((m) => [m.month, m.revenue, m.fuelCost, m.maintenance, m.netProfit]),
    [],
    ["Vehicle", "Trips", "Distance (km)", "Fuel cost", "Cost per km"],
    ...data.vehicleCosts.map((v) => [v.label, v.trips, v.distanceKm, v.fuelCost, v.costPerKm]),
  ];

  // Quote every field and double any embedded quotes, so a vehicle name with a
  // comma cannot shift the columns.
  const csv = rows
    .map((r) => r.map((cell) => `"${String(cell ?? "").replace(/"/g, '""')}"`).join(","))
    .join("\n");

  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = `ecomiles-report-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Stat tile: label, value, optional supporting line.
 * Proportional figures, not tabular — equal-width digits make a number like
 * 121 look loose at this size.
 */
function Stat({ icon: Icon, label, value, sub, accent = false }) {
  return (
    <div className="card p-4">
      <div className="flex items-center gap-1.5 text-[12px] text-slate-500">
        {Icon && <Icon size={13} />}
        {label}
      </div>
      <div
        className={`mt-1 text-[22px] font-semibold leading-none tracking-tight ${
          accent ? "text-brand-700" : "text-slate-900"
        }`}
      >
        {value}
      </div>
      {sub && <div className="mt-1 text-[11px] text-slate-500">{sub}</div>}
    </div>
  );
}

function VehicleList({ vehicles, bordered = false }) {
  return (
    <dl className={bordered ? "mt-4 space-y-3 border-t border-slate-100 pt-4" : "space-y-3"}>
      {vehicles.map((v) => (
        <div key={v.vehicleId} className="flex items-baseline justify-between gap-3">
          <dt className="min-w-0 truncate text-sm text-slate-800">{v.label}</dt>
          <dd className="shrink-0 text-right">
            <span className="text-sm font-semibold tabular-nums text-slate-900">
              {money(v.fuelCost)}
            </span>
            <span className="ml-2 text-xs tabular-nums text-slate-500">
              {v.trips} trips · {v.distanceKm} km · {money(v.costPerKm)}/km
            </span>
          </dd>
        </div>
      ))}
    </dl>
  );
}

function Panel({ title, sub, children }) {
  return (
    <section className="card mt-4 p-5">
      <div className="mb-4">
        <h2 className="text-[15px] font-semibold text-slate-900">{title}</h2>
        {sub && <p className="mt-0.5 text-xs text-slate-500">{sub}</p>}
      </div>
      {children}
    </section>
  );
}

/**
 * Labels only the final point of the line.
 * A value beside every point is noise; the endpoint is the one that answers
 * "where are we now", and the axis plus tooltip carry the rest.
 */
function LastPointLabel({ points }) {
  if (!points?.length) return null;
  const last = points[points.length - 1];

  return (
    <g>
      <circle cx={last.x} cy={last.y} r={5} fill={ACCENT} stroke="#fff" strokeWidth={2} />
      <text
        x={last.x + 10}
        y={last.y + 4}
        fill="#475569"
        fontSize={11}
        fontWeight={600}
      >
        {last.value} km/l
      </text>
    </g>
  );
}

const TOOLTIP = {
  borderRadius: 10,
  border: "1px solid #e2e8f0",
  boxShadow: "0 8px 24px -8px rgba(16,24,40,.12)",
  fontSize: 12,
  padding: "8px 10px",
};
