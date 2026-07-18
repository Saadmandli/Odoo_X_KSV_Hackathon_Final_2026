import { useEffect, useState } from "react";
import { Route, Sparkles } from "lucide-react";
import { get } from "../lib/api";
import { Avatar } from "./ui";

/**
 * The driver's collection order.
 *
 * Riders are picked up in the order that makes the journey shortest, not the
 * order they happened to book in. On a three-passenger ride the difference is
 * routinely several kilometres, so the saving is shown explicitly.
 */
export default function PickupPlan({ rideId }) {
  const [plan, setPlan] = useState(null);

  useEffect(() => {
    get(`/rides/${rideId}/plan`)
      .then(setPlan)
      .catch(() => {});
  }, [rideId]);

  if (!plan || plan.stops.length === 0) return null;

  return (
    <div className="card mt-3 p-4">
      <div className="flex items-center gap-2">
        <Route size={16} className="text-brand-600" />
        <h2 className="text-[15px] font-semibold text-slate-900">Pickup order</h2>
      </div>

      <ol className="mt-3 space-y-0">
        {plan.stops.map((stop, i) => (
          <li key={stop.bookingId} className="flex gap-3">
            <div className="flex flex-col items-center">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-600 text-[11px] font-semibold text-white">
                {stop.sequence}
              </span>
              {i < plan.stops.length - 1 && <span className="my-0.5 w-px flex-1 bg-slate-200" />}
            </div>

            <div className="flex flex-1 items-center gap-2 pb-4">
              <Avatar name={stop.passenger.name} color={stop.passenger.avatarColor} size={28} />
              <div className="min-w-0">
                <div className="truncate text-sm font-medium text-slate-800">
                  {stop.passenger.name}
                </div>
                <div className="truncate text-xs text-slate-500">{stop.label}</div>
              </div>
            </div>
          </li>
        ))}
      </ol>

      {plan.savedKm > 0 && (
        <div className="flex items-start gap-2 rounded-lg bg-brand-50 px-3 py-2.5">
          <Sparkles size={14} className="mt-0.5 shrink-0 text-brand-600" />
          <p className="text-xs text-brand-800">
            <span className="font-medium">{plan.savedKm} km shorter</span> than collecting
            people in the order they booked — {plan.optimisedKm} km instead of{" "}
            {plan.bookingOrderKm} km.
          </p>
        </div>
      )}
    </div>
  );
}
