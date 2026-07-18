import { Loader2 } from "lucide-react";
import { Sheet as ShadcnSheet, SheetContent, SheetHeader, SheetTitle } from "./ui/sheet";

/**
 * The EcoMiles wordmark.
 *
 * Set as type rather than a drawn logo: "Eco" carries the brand green, "Miles"
 * stays near-black, and the two sit on a single tightened baseline. The colour
 * break does the work an icon would, and it stays crisp at any size and in
 * plain text contexts where an image could not go.
 */
export function Wordmark({ size = "md", className = "" }) {
  const scale = {
    sm: "text-[15px]",
    md: "text-[19px]",
    lg: "text-[28px]",
    xl: "text-[34px]",
  }[size];

  return (
    <span
      className={`${scale} font-semibold leading-none tracking-[-0.02em] ${className}`}
      aria-label="EcoMiles"
    >
      <span className="text-brand-600">Eco</span>
      <span className="text-slate-900">Miles</span>
    </span>
  );
}

/**
 * Live carbon saved, shown in the header.
 *
 * The figure is real — it comes from completed trips, not a decoration — which
 * is the whole point: the environmental claim is measured, not asserted.
 */
export function CarbonChip({ kg, className = "" }) {
  if (!kg || kg <= 0) return null;

  return (
    <span
      title={`${kg} kg of CO₂ not emitted, based on your completed shared trips`}
      className={`inline-flex items-center gap-1.5 rounded-full border border-brand-200 bg-brand-50 px-2.5 py-1 text-[11px] font-medium text-brand-800 ${className}`}
    >
      <LeafMark />
      {kg < 1000 ? kg.toFixed(1) : Math.round(kg)} kg CO₂ saved
    </span>
  );
}

function LeafMark() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
      <path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z" />
      <path d="M2 21c0-3 1.85-5.36 5.08-6" />
    </svg>
  );
}

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

/**
 * Which side of a trip the current user is on.
 *
 * The same employee drives some days and rides others, so "driver" and
 * "passenger" are activities rather than account types. Nothing in the UI
 * should ever leave someone guessing which one they are looking at.
 */
export function RoleBadge({ role, size = "md" }) {
  const driving = role === "driving";
  const pad = size === "sm" ? "px-2 py-0.5 text-[11px]" : "px-2.5 py-1 text-xs";

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full font-medium ${pad} ${
        driving
          ? "bg-brand-600 text-white"
          : "bg-slate-800 text-white"
      }`}
    >
      {driving ? <SteeringIcon /> : <SeatIcon />}
      {driving ? "You are driving" : "You are riding"}
    </span>
  );
}

function SteeringIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="2.5" />
      <path d="M3.5 11h6M14.5 11h6M12 14.5V21" />
    </svg>
  );
}

function SeatIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
      <path d="M7 4v9a3 3 0 0 0 3 3h6" />
      <path d="M17 16v4H8" />
    </svg>
  );
}

/**
 * The single next thing this person should do, in plain language.
 * Shown at the top of a trip so nobody has to work out the state machine.
 */
export function NextStep({ children, tone = "info" }) {
  if (!children) return null;

  const tones = {
    info: "border-slate-200 bg-slate-50 text-slate-700",
    action: "border-brand-200 bg-brand-50 text-brand-800",
    waiting: "border-amber-200 bg-amber-50 text-amber-800",
  };

  return (
    <div className={`rounded-lg border px-3 py-2.5 text-sm ${tones[tone]}`}>
      <span className="font-medium">Next: </span>
      {children}
    </div>
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
  return (
    <ShadcnSheet open={open} onOpenChange={(val) => { if (!val) onClose(); }}>
      <SheetContent side="bottom" className="safe-bottom w-full max-h-[90vh] overflow-y-auto p-4 sm:max-w-md sm:mx-auto">
        {title && (
          <SheetHeader className="border-b border-slate-200 pb-3 mb-3 text-left">
            <SheetTitle className="text-[15px] font-semibold text-slate-900">{title}</SheetTitle>
          </SheetHeader>
        )}
        <div className="max-h-[75vh] overflow-y-auto">
          {children}
        </div>
      </SheetContent>
    </ShadcnSheet>
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
