import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  ArrowUpDown,
  CalendarDays,
  CarFront,
  Clock,
  MapPin,
  Route,
  Leaf,
  Star,
  Users,
  Wallet,
} from "lucide-react";
import { get, post } from "../lib/api";
import { useAuth } from "../lib/auth";
import LocationInput from "../components/LocationInput";
import MapView from "../components/MapView";
import { EmptyRoadArt, RideTogetherArt } from "../components/illustrations";
import { Avatar, Banner, EmptyState, WomenOnlyBadge, money, when } from "../components/ui";
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
  const { user } = useAuth();
  const [mode, setMode] = useState("find");
  const [step, setStep] = useState("form");

  const [origin, setOrigin] = useState(null);
  const [dest, setDest] = useState(null);
  const [departureAt, setDepartureAt] = useState(toLocalInput(new Date(Date.now() + 3600_000)));
  const [seats, setSeats] = useState(1);
  const [fare, setFare] = useState(120);
  const [isRecurring, setIsRecurring] = useState(false);
  const [womenOnly, setWomenOnly] = useState(false);
  const [recurrenceDays, setRecurrenceDays] = useState([1, 2, 3, 4, 5]);

  const [savedPlaces, setSavedPlaces] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [vehicleId, setVehicleId] = useState("");

  const [route, setRoute] = useState(null);
  const [rides, setRides] = useState([]);
  // Rides on this route the searcher is driving themselves, and which were
  // therefore left out of the results.
  const [ownMatching, setOwnMatching] = useState(0);
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
    // Names the field that is missing, and says what "missing" means. The old
    // message asked someone to pick a starting point while the box in front of
    // them was full of text they had just typed — the text is not a location
    // until a suggestion is chosen, and nothing said so.
    if (!origin && !dest) {
      return setError("Choose a pickup and a destination from the suggestions.");
    }
    if (!origin) return setError("Choose your pickup from the list of suggestions.");
    if (!dest) return setError("Choose your destination from the list of suggestions.");

    setBusy(true);
    try {
      // Sending the vehicle lets the server work out a fair per-seat cost from
      // the company's fuel price and that car's mileage.
      const preview = await post("/rides/route-preview", {
        origin,
        dest,
        ...(mode === "offer" && vehicleId ? { vehicleId, seats: Number(seats) } : {}),
      });
      setRoute(preview);
      if (preview.suggestedFare) setFare(preview.suggestedFare.amount);
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
        // Only narrows the results. Women-only rides are already excluded
        // server-side for anyone who cannot book one, so this is a preference
        // rather than the thing keeping the guarantee.
        ...(womenOnly ? { womenOnly: "true" } : {}),
      });
      const found = await get(`/rides/search?${params}`);
      setRides(found.rides);
      setOwnMatching(found.ownMatching ?? 0);
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
        womenOnly,
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

        {route.suggestedFare && mode === "offer" && (
          <div className="card mt-3 p-4">
            <div className="flex items-baseline justify-between">
              <span className="text-sm text-slate-600">Suggested fare per seat</span>
              <span className="text-xl font-semibold text-brand-700">
                {money(route.suggestedFare.amount)}
              </span>
            </div>

            <p className="mt-1 text-xs text-slate-500">{route.suggestedFare.basis}</p>

            <dl className="mt-3 grid grid-cols-2 gap-2 border-t border-slate-100 pt-3 text-xs">
              <div>
                <dt className="text-slate-500">Fuel for this trip</dt>
                <dd className="text-slate-700">
                  {money(route.suggestedFare.fuelCost)} · {route.suggestedFare.litres} L
                </dd>
              </div>
              <div>
                <dt className="text-slate-500">Wear and tear</dt>
                <dd className="text-slate-700">{money(route.suggestedFare.wearCost)}</dd>
              </div>
            </dl>

            <div className="mt-3">
              <label className="label">Your fare per seat</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">₹</span>
                <input
                  type="number"
                  inputMode="numeric"
                  min="0"
                  className="field pl-7"
                  value={fare}
                  onChange={(e) => setFare(e.target.value)}
                />
              </div>
            </div>

            {/* Cost sharing, not a taxi fare. Flag anything well above cost so
                a colleague is not quietly overcharged. */}
            {Number(fare) > route.suggestedFare.amount * 1.5 && (
              <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
                That is {Math.round((Number(fare) / route.suggestedFare.amount) * 100 - 100)}% above
                the running cost of this trip. Carpooling is meant to share the cost, not profit
                from it.
              </p>
            )}

            {Number(fare) > 0 && Number(fare) <= route.suggestedFare.amount && (
              <p className="mt-2 text-xs text-brand-700">
                At or below cost. Your riders are getting a fair deal.
              </p>
            )}
          </div>
        )}

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

        {/* Your own rides are filtered out of search — you cannot book a seat in
            your own car. Without saying so, publishing a ride and then
            searching the same route shows nothing, which looks exactly like the
            ride was never saved. */}
        {ownMatching > 0 && (
          <div className="mt-4 flex items-start gap-2.5 rounded-xl border border-brand-200 bg-brand-50 px-3.5 py-3">
            <CarFront size={16} className="mt-0.5 shrink-0 text-brand-700" />
            <p className="text-sm text-brand-900">
              You are driving {ownMatching === 1 ? "a ride" : `${ownMatching} rides`} on this route
              yourself, so {ownMatching === 1 ? "it is" : "they are"} not listed here.{" "}
              <Link to="/trips" className="font-semibold underline">
                See {ownMatching === 1 ? "it" : "them"} under My trips
              </Link>
              .
            </p>
          </div>
        )}

        {rides.length === 0 ? (
          <div className="mt-4">
            <EmptyState
              art={<EmptyRoadArt className="w-full" />}
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
                    <div className="flex items-center gap-1.5">
                      <span className="truncate font-medium text-slate-900">{ride.driver.name}</span>
                      {ride.driverRating?.average && (
                        <span
                          title={`${ride.driverRating.average} from ${ride.driverRating.count} ${
                            ride.driverRating.count === 1 ? "rating" : "ratings"
                          }`}
                          className="inline-flex shrink-0 items-center gap-0.5 text-xs text-slate-600"
                        >
                          <Star size={11} className="text-amber-500" fill="currentColor" />
                          {ride.driverRating.average}
                          <span className="text-slate-400">({ride.driverRating.count})</span>
                        </span>
                      )}
                      {ride.womenOnly && <WomenOnlyBadge size="sm" />}
                    </div>
                    <div className="truncate text-xs text-slate-500">
                      {ride.driver.department && `${ride.driver.department} · `}
                      {ride.vehicle.model} · {ride.vehicle.registrationNumber}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-semibold text-slate-900">
                      {money(ride.farePerSeat)}
                    </div>
                    <div className="text-[11px] text-slate-500">
                      {money(ride.farePerSeat / ride.distanceKm)}/km
                    </div>
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
    <div className="mx-auto max-w-3xl">
      {/* A headline that states the product, then the search itself. Leading
          with the search rather than a settings-style form is what makes a
          travel site feel like one. */}
      <div className="relative mb-6 overflow-hidden rounded-3xl bg-gradient-to-br from-brand-700 via-brand-700 to-brand-900 px-6 py-8 shadow-lift md:mb-8 md:px-9 md:py-9">
        <div className="pointer-events-none absolute inset-0 bg-grid-soft opacity-[0.06]" />
        <div className="pointer-events-none absolute -right-12 -top-20 h-60 w-60 rounded-full bg-brand-400/25 blur-3xl" />

        <div className="relative flex items-center gap-6">
          <div className="min-w-0 flex-1">
            <h1 className="text-[28px] font-black leading-[1.08] tracking-tight text-white md:text-[38px]">
              Share the commute.
              <br className="hidden sm:block" /> Split the cost.
            </h1>
            <p className="mt-3 max-w-md text-[15px] leading-relaxed text-brand-100/85">
              {mode === "find"
                ? "Book a seat with a colleague heading your way."
                : "Driving in anyway? Offer your empty seats."}
            </p>
          </div>

          {/* Held back until there is room for it: below `md` the headline and
              the search field are what the screen is for. */}
          <RideTogetherArt className="hidden w-48 shrink-0 lg:block" />
        </div>
      </div>

      <Tabs value={mode} onValueChange={(val) => { setMode(val); setError(""); }} className="mb-4">
        <TabsList className="mx-auto grid w-full max-w-sm grid-cols-2">
          <TabsTrigger value="find">Find a ride</TabsTrigger>
          <TabsTrigger value="offer">Offer a ride</TabsTrigger>
        </TabsList>
      </Tabs>

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

        {/* Offered only to women, because only a woman can drive or join one —
            showing the control to everyone would advertise a setting most of
            the people looking at it are not permitted to use. */}
        {user?.gender === "FEMALE" && (
          <div className="rounded-lg border border-violet-200 bg-violet-50/40 p-3">
            <label className="flex items-center justify-between gap-3">
              <span>
                <span className="text-[15px] font-medium text-violet-900">
                  {mode === "find" ? "Women-only rides" : "Make this women-only"}
                </span>
                <span className="block text-xs text-violet-700/80">
                  {mode === "find"
                    ? "Show only rides where the driver and every passenger is a woman"
                    : "Only women will be able to see and book this ride"}
                </span>
              </span>
              <Switch checked={womenOnly} onCheckedChange={setWomenOnly} />
            </label>
          </div>
        )}

        {/* Someone who never answered the gender question cannot see or book a
            women-only ride, and previously had no way to discover that: the
            rides simply were not in her results and the toggle above never
            appeared, so the feature looked broken rather than gated. Shown only
            for UNDISCLOSED — a man has answered, and telling him what he is
            missing would be noise. */}
        {user?.gender === "UNDISCLOSED" && (
          <div className="rounded-lg border border-violet-200 bg-violet-50/40 p-3">
            <p className="text-[13.5px] font-medium text-violet-900">
              Looking for women-only rides?
            </p>
            <p className="mt-0.5 text-xs leading-relaxed text-violet-700/90">
              They stay hidden until you set your gender, so they are only ever offered to the
              people who can travel on them.{" "}
              <Link to="/settings" className="font-semibold underline">
                Set it in Settings
              </Link>
              .
            </p>
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
                className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700 shadow-card transition hover:border-brand-300 hover:bg-brand-50/40"
              >
                <MapPin size={13} className="text-slate-400" />
                {p.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Three reasons to use it, stated with this organisation's own numbers
          rather than slogans. Real figures are more persuasive than claims. */}
      <div className="mt-10 grid gap-4 sm:grid-cols-3">
        {[
          {
            icon: Users,
            title: "Colleagues only",
            body: "Every ride is with someone from your organisation. No strangers.",
          },
          {
            icon: Wallet,
            title: "Cost, not fare",
            body: "Fares come from real fuel price and mileage, split across the car.",
          },
          {
            icon: Leaf,
            title: "Measured impact",
            body: "Every shared seat is one car that did not make the journey.",
          },
        ].map(({ icon: Icon, title, body }) => (
          <div key={title} className="text-center sm:text-left">
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand-700">
              <Icon size={19} />
            </span>
            <h3 className="mt-3 text-[15px] font-semibold text-slate-900">{title}</h3>
            <p className="mt-1 text-sm leading-relaxed text-slate-500">{body}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
