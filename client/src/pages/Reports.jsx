import { useEffect, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Fuel, Leaf, Route, TrendingUp, Wallet } from "lucide-react";
import { get } from "../lib/api";
import { Banner, EmptyState, Spinner, money } from "../components/ui";

const BRAND = "#286b57";
const AXIS = { stroke: "#94a3b8", fontSize: 11 };

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
      <div className="mx-auto max-w-2xl">
        <h1 className="text-xl font-semibold tracking-tight text-slate-900">Reports</h1>
        <div className="mt-4">
          <EmptyState
            icon={TrendingUp}
            title="No completed trips yet"
            hint="Your fuel, cost and efficiency figures appear here once you have finished a trip."
          />
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="text-xl font-semibold tracking-tight text-slate-900">Reports</h1>
      <p className="mt-1 text-sm text-slate-500">
        Calculated from your completed trips and your company's fuel price.
      </p>

      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat icon={Route} label="Total trips" value={s.totalTrips} sub={`${s.tripsAsDriver} driving`} />
        <Stat icon={Route} label="Distance" value={`${Math.round(s.totalDistanceKm)} km`} />
        <Stat icon={Fuel} label="Fuel used" value={`${s.fuelConsumedLitres} L`} sub={money(s.fuelCost)} />
        <Stat icon={Wallet} label="Cost per km" value={money(s.costPerKm)} />
      </div>

      {/* The sustainability line the problem statement opens with. */}
      <div className="mt-3 flex items-center gap-3 rounded-xl2 border border-brand-200 bg-brand-50 p-4">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-600 text-white">
          <Leaf size={18} />
        </span>
        <div>
          <div className="text-[15px] font-medium text-brand-900">
            {s.co2SavedKg} kg of CO₂ not emitted
          </div>
          <div className="text-xs text-brand-700">
            By sharing instead of driving separately.
          </div>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-3">
        <div className="card px-4 py-3">
          <div className="text-xs text-slate-500">Earned as driver</div>
          <div className="mt-0.5 text-lg font-semibold text-brand-700">{money(s.totalEarned)}</div>
        </div>
        <div className="card px-4 py-3">
          <div className="text-xs text-slate-500">Spent as rider</div>
          <div className="mt-0.5 text-lg font-semibold text-slate-900">{money(s.totalSpent)}</div>
        </div>
      </div>

      {data.fuelEfficiencyTrend.length > 0 && (
        <Panel title="Fuel efficiency trend" sub="Kilometres per litre, by month">
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={data.fuelEfficiencyTrend} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
              <XAxis dataKey="month" tickLine={false} axisLine={false} tick={AXIS} />
              <YAxis tickLine={false} axisLine={false} tick={AXIS} />
              <Tooltip
                contentStyle={tooltipStyle}
                formatter={(v) => [`${v} km/l`, "Efficiency"]}
              />
              <Line
                type="monotone"
                dataKey="efficiencyKmpl"
                stroke={BRAND}
                strokeWidth={2.5}
                dot={{ r: 3, fill: BRAND }}
                activeDot={{ r: 5 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </Panel>
      )}

      {data.vehicleCosts.length > 0 && (
        <Panel title="Cost by vehicle" sub="Fuel spend across your registered vehicles">
          <ResponsiveContainer width="100%" height={Math.max(140, data.vehicleCosts.length * 52)}>
            <BarChart
              data={data.vehicleCosts.slice(0, 5)}
              layout="vertical"
              margin={{ top: 4, right: 16, left: 8, bottom: 4 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
              <XAxis type="number" tickLine={false} axisLine={false} tick={AXIS} />
              <YAxis
                type="category"
                dataKey="label"
                width={130}
                tickLine={false}
                axisLine={false}
                tick={{ ...AXIS, fontSize: 10 }}
              />
              <Tooltip contentStyle={tooltipStyle} formatter={(v) => [money(v), "Fuel cost"]} />
              <Bar dataKey="fuelCost" radius={[0, 4, 4, 0]} barSize={18}>
                {data.vehicleCosts.slice(0, 5).map((_, i) => (
                  <Cell key={i} fill={i === 0 ? BRAND : "#8cc3ae"} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>

          <div className="mt-3 space-y-2 border-t border-slate-100 pt-3">
            {data.vehicleCosts.map((v) => (
              <div key={v.vehicleId} className="flex items-center justify-between text-sm">
                <span className="min-w-0 truncate text-slate-700">{v.label}</span>
                <span className="shrink-0 text-slate-500">
                  {v.trips} trips · {v.distanceKm} km · {money(v.costPerKm)}/km
                </span>
              </div>
            ))}
          </div>
        </Panel>
      )}

      {data.monthlySummary.length > 0 && (
        <Panel title="Monthly summary" sub="Revenue against running costs">
          {/* Phones get stacked rows. A five-column table on a 375px screen
              either overflows the card or scrolls sideways, and both read as
              broken. */}
          <div className="divide-y divide-slate-100 sm:hidden">
            {data.monthlySummary.map((m) => (
              <div key={m.month} className="py-3 first:pt-0 last:pb-0">
                <div className="flex items-baseline justify-between">
                  <span className="text-[15px] font-medium text-slate-900">{m.month}</span>
                  <span
                    className={`text-[15px] font-semibold ${
                      m.netProfit >= 0 ? "text-brand-700" : "text-rose-600"
                    }`}
                  >
                    {money(m.netProfit)}
                  </span>
                </div>
                <dl className="mt-1.5 grid grid-cols-3 gap-2 text-xs">
                  {[
                    ["Revenue", m.revenue],
                    ["Fuel", m.fuelCost],
                    ["Upkeep", m.maintenance],
                  ].map(([label, value]) => (
                    <div key={label}>
                      <dt className="text-slate-500">{label}</dt>
                      <dd className="text-slate-700">{money(value)}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            ))}
          </div>

          <div className="hidden sm:block">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs text-slate-500">
                  <th className="pb-2 font-medium">Month</th>
                  <th className="pb-2 text-right font-medium">Revenue</th>
                  <th className="pb-2 text-right font-medium">Fuel</th>
                  <th className="pb-2 text-right font-medium">Upkeep</th>
                  <th className="pb-2 text-right font-medium">Net</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.monthlySummary.map((m) => (
                  <tr key={m.month}>
                    <td className="py-2 text-slate-700">{m.month}</td>
                    <td className="py-2 text-right text-slate-700">{money(m.revenue)}</td>
                    <td className="py-2 text-right text-slate-700">{money(m.fuelCost)}</td>
                    <td className="py-2 text-right text-slate-700">{money(m.maintenance)}</td>
                    <td
                      className={`py-2 text-right font-medium ${
                        m.netProfit >= 0 ? "text-brand-700" : "text-rose-600"
                      }`}
                    >
                      {money(m.netProfit)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      )}
    </div>
  );
}

function Stat({ icon: Icon, label, value, sub }) {
  return (
    <div className="card px-4 py-3">
      <div className="flex items-center gap-1.5 text-[12px] text-slate-500">
        <Icon size={13} />
        {label}
      </div>
      <div className="mt-0.5 text-xl font-semibold text-slate-900">{value}</div>
      {sub && <div className="text-[11px] text-slate-500">{sub}</div>}
    </div>
  );
}

function Panel({ title, sub, children }) {
  return (
    <div className="card mt-4 p-4">
      <div className="mb-3">
        <h2 className="text-[15px] font-semibold text-slate-900">{title}</h2>
        {sub && <p className="text-xs text-slate-500">{sub}</p>}
      </div>
      {children}
    </div>
  );
}

const tooltipStyle = {
  borderRadius: 8,
  border: "1px solid #e2e8f0",
  fontSize: 12,
  boxShadow: "0 4px 12px rgba(16,24,40,.08)",
};
