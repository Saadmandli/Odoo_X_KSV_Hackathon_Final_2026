import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { CarFront, Route } from "lucide-react";
import { EmptyRoadArt } from "../components/illustrations";
import { get } from "../lib/api";
import { Avatar, EmptyState, RoleBadge, Spinner, WomenOnlyBadge, money, when } from "../components/ui";

export default function History() {
  const [data, setData] = useState(null);

  useEffect(() => {
    get("/bookings/history")
      .then(setData)
      .catch(() => setData({ asPassenger: [], asDriver: [] }));
  }, []);

  if (!data) return <Spinner label="Loading ride history" />;

  // One list, newest first, regardless of which side the user was on.
  const entries = [
    ...data.asPassenger.map((b) => ({
      id: b.id,
      role: "riding",
      ride: b.ride,
      amount: b.fareAmount,
      paid: b.payment?.status === "COMPLETED",
      at: b.ride.completedAt ?? b.ride.departureAt,
      counterpart: b.ride.driver,
    })),
    ...data.asDriver.map((r) => ({
      id: r.id,
      role: "driving",
      ride: r,
      amount: Number(r.farePerSeat) * (r.bookings?.length ?? 0),
      paid: true,
      at: r.completedAt ?? r.departureAt,
      riders: r.bookings ?? [],
    })),
  ].sort((a, b) => new Date(b.at) - new Date(a.at));

  const totalKm = entries.reduce((s, e) => s + Number(e.ride.distanceKm ?? 0), 0);

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-xl font-semibold tracking-tight text-slate-900">Ride history</h1>
      <p className="mt-1 text-sm text-slate-500">Every completed journey, driving or riding.</p>

      {entries.length === 0 ? (
        <div className="mt-4">
          <EmptyState
            art={<EmptyRoadArt className="w-full" />}
            title="Nothing here yet"
            hint="Completed trips will appear here once you have taken your first ride."
            action={
              <Link to="/dashboard" className="btn-secondary btn-sm">
                Find a ride
              </Link>
            }
          />
        </div>
      ) : (
        <>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <div className="card px-4 py-3">
              <div className="text-xs text-slate-500">Completed trips</div>
              <div className="mt-0.5 text-xl font-semibold text-slate-900">{entries.length}</div>
            </div>
            <div className="card px-4 py-3">
              <div className="text-xs text-slate-500">Distance shared</div>
              <div className="mt-0.5 text-xl font-semibold text-slate-900">
                {Math.round(totalKm)} km
              </div>
            </div>
          </div>

          <div className="mt-4 space-y-3">
            {entries.map((e) => (
              <Link
                key={`${e.role}-${e.id}`}
                to={`/trips/${e.ride.id}`}
                className="card block p-4 transition hover:shadow-lift"
              >
                <div className="mb-3 flex flex-wrap items-center gap-2">
                  <RoleBadge role={e.role} size="sm" />
                  {e.ride.womenOnly && <WomenOnlyBadge size="sm" />}
                  <span className="ml-auto text-xs text-slate-500">{when(e.at)}</span>
                </div>

                <div className="flex items-center gap-3">
                  {e.role === "riding" ? (
                    <Avatar name={e.counterpart.name} color={e.counterpart.avatarColor} size={36} />
                  ) : (
                    <span className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-slate-500">
                      <CarFront size={17} />
                    </span>
                  )}

                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[15px] text-slate-800">
                      {e.ride.originLabel.split(",")[0]} to {e.ride.destLabel.split(",")[0]}
                    </div>
                    <div className="truncate text-xs text-slate-500">
                      {e.role === "riding"
                        ? `${e.counterpart.name} · ${e.ride.vehicle?.model ?? ""}`
                        : `${e.riders.length} ${e.riders.length === 1 ? "rider" : "riders"} · ${e.ride.vehicle?.model ?? ""}`}
                    </div>
                  </div>

                  <div className="shrink-0 text-right">
                    <div className="text-[15px] font-semibold text-slate-900">{money(e.amount)}</div>
                    <div className="inline-flex items-center gap-1 text-[11px] text-slate-500">
                      <Route size={11} />
                      {e.ride.distanceKm} km
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
