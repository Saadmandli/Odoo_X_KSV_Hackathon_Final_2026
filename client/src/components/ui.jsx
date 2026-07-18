import { Loader2 } from "lucide-react";

export function Avatar({ name = "?", color, size = 36 }) {
  const initials = name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();

  return (
    <span
      className="inline-flex shrink-0 items-center justify-center rounded-full font-semibold text-white"
      style={{ background: color || "#286b57", width: size, height: size, fontSize: size * 0.38 }}
    >
      {initials}
    </span>
  );
}

export function Spinner({ label }) {
  return (
    <div className="flex items-center justify-center gap-2 py-12 text-sm text-slate-500">
      <Loader2 size={16} className="animate-spin" />
      {label}
    </div>
  );
}

export function EmptyState({ icon: Icon, title, hint, action }) {
  return (
    <div className="card flex flex-col items-center gap-3 px-6 py-12 text-center">
      {Icon && (
        <span className="flex h-11 w-11 items-center justify-center rounded-full bg-slate-100 text-slate-400">
          <Icon size={20} />
        </span>
      )}
      <div>
        <p className="font-medium text-slate-800">{title}</p>
        {hint && <p className="mt-1 max-w-xs text-sm text-slate-500">{hint}</p>}
      </div>
      {action}
    </div>
  );
}

export function StatCard({ icon: Icon, label, value, sub }) {
  return (
    <div className="card px-4 py-3">
      <div className="flex items-center gap-1.5 text-[12px] text-slate-500">
        {Icon && <Icon size={13} />}
        {label}
      </div>
      <div className="mt-1 text-xl font-semibold text-slate-900">{value}</div>
      {sub && <div className="text-[11px] text-slate-500">{sub}</div>}
    </div>
  );
}

const STATUS_STYLES = {
  PUBLISHED: "bg-sky-50 text-sky-700 border border-sky-200",
  BOOKED: "bg-sky-50 text-sky-700 border border-sky-200",
  STARTED: "bg-amber-50 text-amber-700 border border-amber-200",
  IN_PROGRESS: "bg-amber-50 text-amber-700 border border-amber-200",
  COMPLETED: "bg-brand-50 text-brand-700 border border-brand-200",
  CANCELLED: "bg-rose-50 text-rose-700 border border-rose-200",
  PENDING: "bg-amber-50 text-amber-700 border border-amber-200",
};

const STATUS_LABELS = {
  PUBLISHED: "Open",
  BOOKED: "Booked",
  STARTED: "Started",
  IN_PROGRESS: "In progress",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
  PENDING: "Payment pending",
};

export function StatusChip({ status, children }) {
  return (
    <span className={`chip ${STATUS_STYLES[status] ?? "bg-slate-100 text-slate-600"}`}>
      {children ?? STATUS_LABELS[status] ?? status}
    </span>
  );
}

export function Banner({ kind = "error", children }) {
  if (!children) return null;
  const styles =
    kind === "error"
      ? "border-rose-200 bg-rose-50 text-rose-700"
      : "border-brand-200 bg-brand-50 text-brand-700";
  return <div className={`rounded-lg border px-3 py-2 text-sm ${styles}`}>{children}</div>;
}

/** Bottom sheet on phones, centred dialog from tablet up. */
export function Sheet({ open, onClose, title, children }) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[1100] flex items-end sm:items-center sm:justify-center">
      <div className="absolute inset-0 bg-slate-900/40" onClick={onClose} />
      <div className="safe-bottom relative w-full rounded-t-2xl bg-white shadow-sheet sm:max-w-md sm:rounded-2xl">
        {title && (
          <div className="border-b border-slate-200 px-4 py-3 text-[15px] font-semibold text-slate-900">
            {title}
          </div>
        )}
        <div className="max-h-[75vh] overflow-y-auto p-4">{children}</div>
      </div>
    </div>
  );
}

export const money = (n) =>
  `₹${Number(n ?? 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;

export const when = (d) =>
  new Date(d).toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });

export const dayMonth = (d) =>
  new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
