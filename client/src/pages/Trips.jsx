import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { CalendarDays, CarFront, ClipboardList, Route, Users } from "lucide-react";
import { get } from "../lib/api";
import { Avatar, EmptyState, RoleBadge, Spinner, StatusChip, money, when } from "../components/ui";

export default function Trips() {
  const [data, setData] = useState(null);
  const [tab, setTab] = useState("rider");

  useEffect(() => {
    get("/bookings/my-trips").then(setData).catch(() => setData({ asPassenger: [], asDriver: [] }));
  }, []);

  if (!data) return <Spinner label="Loading your trips" />;

  const rider = data.asPassenger.filter((b) => b.status !== "CANCELLED");
  const driver = data.asDriver;
  const list = tab === "rider" ? rider : driver;

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-xl font-semibold tracking-tight text-slate-900">My trips</h1>
      <p className="mt-1 text-sm text-slate-500">
        The same account does both. Seats you booked are under Riding; rides you
        published are under Driving.
      </p>

      <div className="mt-4 grid grid-cols-2 gap-1 rounded-xl2 border border-slate-200 bg-white p-1">
        {[
          ["rider", `Riding (${rider.length})`],
          ["driver", `Driving (${driver.length})`],
        ].map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`rounded-lg py-2 text-sm font-medium transition ${
              tab === key ? "bg-brand-600 text-white" : "text-slate-600"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {list.length === 0 ? (
        <div className="mt-4">
          <EmptyState
            icon={ClipboardList}
            title={tab === "rider" ? "No booked rides" : "You have not offered a ride yet"}
            hint={
              tab === "rider"
                ? "Search for a ride along your route and book a seat."
                : "Publish a ride on a route you already drive and share the cost."
            }
            action={
              <Link to="/dashboard" className="btn-secondary btn-sm">
                {tab === "rider" ? "Find a ride" : "Offer a ride"}
              </Link>
            }
          />
        </div>
      ) : (
        <div className="mt-4 space-y-3">
          {tab === "rider"
            ? rider.map((b) => <RiderCard key={b.id} booking={b} />)
            : driver.map((r) => <DriverCard key={r.id} ride={r} />)}
        </div>
      )}
    </div>
  );
}

function RiderCard({ booking }) {
  const ride = booking.ride;
  const paid = booking.payment?.status === "COMPLETED";
  const needsPayment = ride.status === "COMPLETED" && !paid;

  return (
    <Link to={`/trips/${ride.id}`} className="card block p-4 transition hover:shadow-lift">
      <div className="mb-3 flex items-center gap-2">
        <RoleBadge role="riding" size="sm" />
        <StatusChip status={needsPayment ? "PENDING" : ride.status} />
      </div>

      <div className="flex items-center gap-3">
        <Avatar name={ride.driver.name} color={ride.driver.avatarColor} size={38} />
        <div className="min-w-0 flex-1">
          <div className="truncate font-medium text-slate-900">{ride.driver.name}</div>
          <div className="truncate text-xs text-slate-500">
            Driving · {ride.vehicle.model} · {ride.vehicle.registrationNumber}
          </div>
        </div>
      </div>

      <RouteLine from={ride.originLabel} to={ride.destLabel} />

      <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-3">
        <span className="inline-flex items-center gap-1 text-xs text-slate-500">
          <CalendarDays size={12} />
          {when(ride.departureAt)}
        </span>
        <span className="text-sm font-semibold text-slate-900">{money(booking.fareAmount)}</span>
      </div>

      {needsPayment && (
        <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
          Trip finished. Payment is pending.
        </p>
      )}
    </Link>
  );
}

function DriverCard({ ride }) {
  const riders = ride.bookings.filter((b) => b.status !== "CANCELLED");

  return (
    <Link to={`/trips/${ride.id}`} className="card block p-4 transition hover:shadow-lift">
      <div className="mb-3 flex items-center gap-2">
        <RoleBadge role="driving" size="sm" />
        <StatusChip status={ride.status} />
      </div>

      <div className="flex items-center gap-2">
        <CarFront size={17} className="text-slate-400" />
        <span className="text-sm font-medium text-slate-900">
          {ride.vehicle.model} · {ride.vehicle.registrationNumber}
        </span>
      </div>

      <RouteLine from={ride.originLabel} to={ride.destLabel} />

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-slate-100 pt-3 text-xs text-slate-500">
        <span className="inline-flex items-center gap-1">
          <CalendarDays size={12} />
          {when(ride.departureAt)}
        </span>
        <span className="inline-flex items-center gap-1">
          <Route size={12} />
          {ride.distanceKm} km
        </span>
        <span className="inline-flex items-center gap-1">
          <Users size={12} />
          {riders.length} of {ride.totalSeats} booked
        </span>
      </div>

      {riders.length > 0 && (
        <div className="mt-3 flex -space-x-2">
          {riders.map((b) => (
            <span key={b.id} className="ring-2 ring-white rounded-full">
              <Avatar name={b.passenger.name} color={b.passenger.avatarColor} size={28} />
            </span>
          ))}
        </div>
      )}
    </Link>
  );
}

function RouteLine({ from, to }) {
  return (
    <div className="mt-3 space-y-1.5 text-sm">
      <div className="flex items-start gap-2">
        <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-brand-600" />
        <span className="truncate text-slate-700">{from}</span>
      </div>
      <div className="flex items-start gap-2">
        <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-rose-600" />
        <span className="truncate text-slate-700">{to}</span>
      </div>
    </div>
  );
}
