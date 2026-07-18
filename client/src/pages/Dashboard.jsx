import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  ArrowUpDown,
  CalendarDays,
  CarFront,
  Clock,
  MapPin,
  Route,
  SearchX,
  Users,
} from "lucide-react";
import { get, post } from "../lib/api";
import LocationInput from "../components/LocationInput";
import MapView from "../components/MapView";
import { Avatar, Banner, EmptyState, money, when } from "../components/ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

const DAYS = ["S", "M", "T", "W", "T", "F", "S"];
const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

// <input type="datetime-local"> rejects the trailing "Z" from toISOString().
const toLocalInput = (d) => {
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
};

export default function Dashboard() {
  const navigate = useNavigate();
  const [mode, setMode] = useState("find");
  const [step, setStep] = useState("form");

  const [origin, setOrigin] = useState(null);
  const [dest, setDest] = useState(null);
  const [departureAt, setDepartureAt] = useState(toLocalInput(new Date(Date.now() + 3600_000)));
  const [seats, setSeats] = useState(1);
  const [fare, setFare] = useState(120);
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurrenceDays, setRecurrenceDays] = useState([1, 2, 3, 4, 5]);

  const [savedPlaces, setSavedPlaces] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [vehicleId, setVehicleId] = useState("");

  const [route, setRoute] = useState(null);
  const [rides, setRides] = useState([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    get("/places").then((d) => setSavedPlaces(d.places)).catch(() => {});
    get("/vehicles")
      .then((d) => {
        setVehicles(d.vehicles);
        if (d.vehicles[0]) setVehicleId(d.vehicles[0].id);
      })
      .catch(() => {});
  }, []);

  const swap = () => {
    setOrigin(dest);
    setDest(origin);
  };

  const confirmRoute = async () => {
    setError("");
    if (!origin || !dest) return setError("Pick a starting point and a destination.");

    setBusy(true);
    try {
      setRoute(await post("/rides/route-preview", { origin, dest }));
      setStep("route");
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const findRides = async () => {
    setBusy(true);
    setError("");
    try {
      const params = new URLSearchParams({
        originLat: origin.lat,
        originLng: origin.lng,
        destLat: dest.lat,
        destLng: dest.lng,
        seats: String(seats),
        departureAt: new Date(departureAt).toISOString(),
      });
      setRides((await get(`/rides/search?${params}`)).rides);
      setStep("results");
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const publishRide = async () => {
    setBusy(true);
    setError("");
    try {
      await post("/rides", {
        vehicleId,
        origin,
        dest,
        departureAt: new Date(departureAt).toISOString(),
        seats: Number(seats),
        farePerSeat: Number(fare),
        isRecurring,
        recurrenceDays: isRecurring ? recurrenceDays : [],
      });
      navigate("/trips");
    } catch (err) {
      setError(err.message);
      setStep("form");
    } finally {
      setBusy(false);
    }
  };

  const book = async (ride) => {
    setBusy(true);
    setError("");
    try {
      await post("/bookings", { rideId: ride.id, seats: Number(seats), pickup: origin, drop: dest });
      navigate("/trips");
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  // ------------------------------------------------------------- route step
  if (step === "route") {
    return (
      <div className="mx-auto max-w-2xl">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setStep("form")}
          className="mb-3 pl-0 hover:bg-transparent text-slate-600"
        >
          <ArrowLeft size={16} />
          Back
        </Button>

        <h1 className="text-xl font-semibold tracking-tight text-slate-900">Confirm your route</h1>
        <p className="mt-1 text-[15px] text-slate-500">
          Check the pickup and drop before you continue.
        </p>

        <MapView
          origin={origin}
          dest={dest}
          geometry={route.geometry}
          className="mt-4 h-56 w-full sm:h-72"
        />

        <div className="card mt-4 divide-y divide-slate-100">
          <div className="flex items-start gap-3 p-4">
            <MapPin size={17} className="mt-0.5 shrink-0 text-brand-600" />
            <div className="min-w-0">
              <div className="text-xs text-slate-500">From</div>
              <div className="text-[15px] text-slate-900">{origin.label}</div>
            </div>
          </div>
          <div className="flex items-start gap-3 p-4">
            <MapPin size={17} className="mt-0.5 shrink-0 text-rose-600" />
            <div className="min-w-0">
              <div className="text-xs text-slate-500">To</div>
              <div className="text-[15px] text-slate-900">{dest.label}</div>
            </div>
          </div>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-3">
          <div className="card px-4 py-3">
            <div className="flex items-center gap-1.5 text-xs text-slate-500">
              <Route size={13} />
              Distance
            </div>
            <div className="mt-0.5 text-lg font-semibold text-slate-900">{route.distanceKm} km</div>
          </div>
          <div className="card px-4 py-3">
            <div className="flex items-center gap-1.5 text-xs text-slate-500">
              <Clock size={13} />
              Duration
            </div>
            <div className="mt-0.5 text-lg font-semibold text-slate-900">{route.durationMin} min</div>
          </div>
        </div>

        {route.source === "fallback" && (
          <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
            Road routing is unavailable right now, so this is a direct-line estimate.
          </p>
        )}

        <div className="mt-4">
          <Banner>{error}</Banner>
        </div>

        <Button
          className="mt-4 w-full"
          disabled={busy}
          onClick={mode === "find" ? findRides : publishRide}
        >
          {busy ? "Please wait" : mode === "find" ? "Search rides" : "Publish ride"}
        </Button>
      </div>
    );
  }

  // ----------------------------------------------------------- results step
  if (step === "results") {
    return (
      <div className="mx-auto max-w-2xl">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setStep("form")}
          className="mb-3 pl-0 hover:bg-transparent text-slate-600"
        >
          <ArrowLeft size={16} />
          Change search
        </Button>

        <div className="flex items-baseline justify-between gap-3">
          <h1 className="text-xl font-semibold tracking-tight text-slate-900">
            {rides.length} {rides.length === 1 ? "ride" : "rides"} available
          </h1>
          <Button variant="link" onClick={findRides} className="h-auto p-0 font-medium text-primary" disabled={busy}>
            Refresh
          </Button>
        </div>
        <p className="mt-1 truncate text-sm text-slate-500">
          {origin.label} to {dest.label}
        </p>

        <div className="mt-4">
          <Banner>{error}</Banner>
        </div>

        {rides.length === 0 ? (
          <div className="mt-4">
            <EmptyState
              icon={SearchX}
              title="No rides on this route yet"
              hint="Nobody is driving this way near your time. You could offer the ride instead."
              action={
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setMode("offer");
                    setStep("form");
                  }}
                >
                  Offer this ride
                </Button>
              }
            />
          </div>
        ) : (
          <div className="mt-4 space-y-3">
            {rides.map((ride) => (
              <div key={ride.id} className="card p-4">
                <div className="flex items-center gap-3">
                  <Avatar name={ride.driver.name} color={ride.driver.avatarColor} size={40} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium text-slate-900">{ride.driver.name}</div>
                    <div className="truncate text-xs text-slate-500">
                      {ride.vehicle.model} · {ride.vehicle.registrationNumber}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-semibold text-slate-900">
                      {money(ride.farePerSeat)}
                    </div>
                    <div className="text-[11px] text-slate-500">per seat</div>
                  </div>
                </div>

                <div className="mt-3 space-y-1.5 border-t border-slate-100 pt-3 text-sm">
                  <div className="flex items-start gap-2">
                    <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-brand-600" />
                    <span className="text-slate-700">{ride.originLabel}</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-rose-600" />
                    <span className="text-slate-700">{ride.destLabel}</span>
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
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
                    {ride.seatsLeft} left
                  </span>
                </div>

                {ride.match.detourKm > 0.3 && (
                  <p className="mt-2 text-xs text-slate-500">
                    Pickup is {ride.match.pickupDistanceKm} km from your start.
                  </p>
                )}

                <Button
                  size="sm"
                  className="mt-3 w-full"
                  disabled={busy || ride.seatsLeft < seats}
                  onClick={() => book(ride)}
                >
                  Book {seats} {seats === 1 ? "seat" : "seats"}
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // -------------------------------------------------------------- form step
  return (
    <div className="mx-auto max-w-2xl">
      <Tabs value={mode} onValueChange={(val) => { setMode(val); setError(""); }} className="mb-4">
        <TabsList className="grid grid-cols-2 w-full">
          <TabsTrigger value="find">Find a ride</TabsTrigger>
          <TabsTrigger value="offer">Offer a ride</TabsTrigger>
        </TabsList>
      </Tabs>

      {/* The same employee does both. Saying so removes the most common
          confusion for anyone seeing the app for the first time. */}
      <p className="mb-4 px-1 text-sm text-slate-500">
        {mode === "find"
          ? "Book a seat in a colleague's car and split the running cost."
          : "Driving in anyway? Publish your empty seats and share the cost."}
      </p>

      <div className="card space-y-4 p-4">
        <div className="relative space-y-3">
          <div>
            <label className="label">Pickup</label>
            <LocationInput
              value={origin}
              onChange={setOrigin}
              placeholder="Where are you starting?"
              savedPlaces={savedPlaces}
            />
          </div>
          <div>
            <label className="label">Destination</label>
            <LocationInput
              value={dest}
              onChange={setDest}
              placeholder="Where are you going?"
              savedPlaces={savedPlaces}
            />
          </div>

          <Button
            variant="outline"
            size="icon"
            onClick={swap}
            aria-label="Swap pickup and destination"
            className="absolute -top-1 right-0 flex h-9 w-9 items-center justify-center rounded-full border border-slate-300 bg-white text-slate-600 shadow-card"
            style={{ top: "42%" }}
          >
            <ArrowUpDown size={15} />
          </Button>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Departure</label>
            <Input
              type="datetime-local"
              // Convenience only. The picker can be bypassed, so the server
              // enforces the same rule on publish and on booking.
              min={toLocalInput(new Date())}
              value={departureAt}
              onChange={(e) => setDepartureAt(e.target.value)}
            />
          </div>
          <div>
            <label className="label">{mode === "find" ? "Seats needed" : "Seats offered"}</label>
            <select
              className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-[15px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/15 disabled:cursor-not-allowed disabled:opacity-50"
              value={seats}
              onChange={(e) => setSeats(Number(e.target.value))}
            >
              {[1, 2, 3, 4, 5, 6].map((n) => (
                <option key={n} value={n}>
                  {n} {n === 1 ? "seat" : "seats"}
                </option>
              ))}
            </select>
          </div>
        </div>

        {mode === "offer" && (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="label">Vehicle</label>
              <select
                className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-[15px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/15 disabled:cursor-not-allowed disabled:opacity-50"
                value={vehicleId}
                onChange={(e) => setVehicleId(e.target.value)}
              >
                {vehicles.length === 0 && <option value="">No vehicle registered</option>}
                {vehicles.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.model} · {v.registrationNumber}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Fare per seat</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">₹</span>
                <Input
                  type="number"
                  inputMode="numeric"
                  min="0"
                  className="pl-7"
                  value={fare}
                  onChange={(e) => setFare(e.target.value)}
                />
              </div>
            </div>
          </div>
        )}

        <div className="rounded-lg border border-slate-200 p-3">
          <label className="flex items-center justify-between gap-3">
            <span>
              <span className="text-[15px] text-slate-800">Repeat weekly</span>
              <span className="block text-xs text-slate-500">
                {isRecurring
                  ? recurrenceDays.map((d) => DAY_NAMES[d]).join(", ") || "Pick at least one day"
                  : "For a regular commute"}
              </span>
            </span>
            <Switch
              checked={isRecurring}
              onCheckedChange={(checked) => setIsRecurring(checked)}
            />
          </label>

          {isRecurring && (
            <div className="mt-3 flex gap-1.5">
              {DAYS.map((d, i) => (
                <Button
                  key={i}
                  type="button"
                  variant={recurrenceDays.includes(i) ? "default" : "secondary"}
                  aria-label={DAY_NAMES[i]}
                  onClick={() =>
                    setRecurrenceDays((days) =>
                      days.includes(i) ? days.filter((x) => x !== i) : [...days, i].sort()
                    )
                  }
                  className="h-9 flex-1"
                >
                  {d}
                </Button>
              ))}
            </div>
          )}
        </div>

        {mode === "offer" && vehicles.length === 0 && (
          <Banner>
            Add a vehicle before offering a ride.{" "}
            <Button
              variant="link"
              onClick={() => navigate("/vehicles")}
              className="h-auto p-0 font-medium underline text-primary"
            >
              Add one now
            </Button>
          </Banner>
        )}

        <Banner>{error}</Banner>

        <Button
          className="w-full"
          onClick={confirmRoute}
          disabled={busy || (mode === "offer" && vehicles.length === 0)}
        >
          {busy ? "Working out the route" : mode === "find" ? "Search" : "Continue"}
        </Button>
      </div>

      {savedPlaces.length > 0 && (
        <div className="mt-4">
          <p className="mb-2 px-1 text-xs font-medium uppercase tracking-wide text-slate-400">
            Saved places
          </p>
          <div className="flex flex-wrap gap-2">
            {savedPlaces.map((p) => (
              <button
                key={p.id}
                onClick={() =>
                  setOrigin({ label: p.address, lat: p.lat, lng: p.lng })
                }
                className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700 shadow-card"
              >
                <MapPin size={13} className="text-slate-400" />
                {p.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
