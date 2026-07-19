import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  Check,
  Copy,
  MapPin,
  MessageSquare,
  Navigation,
  Phone,
  Play,
  Send,
  Share2,
  ShieldCheck,
  Flag,
  Repeat,
} from "lucide-react";
import { get, post } from "../lib/api";
import { useAuth } from "../lib/auth";
import MapView from "../components/MapView";
import { decodePolyline } from "../lib/polyline";
import PickupPlan from "../components/PickupPlan";
import RateDriver from "../components/RateDriver";
import { SosButton } from "../components/SosButton";
import {
  Avatar,
  Banner,
  NextStep,
  RoleBadge,
  Sheet,
  Spinner,
  StatusChip,
  WomenOnlyBadge,
  money,
  when,
} from "../components/ui";

// Live tracking polls rather than holding a socket open: nothing to reconnect,
// no dropped connection mid-demo, and it behaves the same on every host.
const TRACK_INTERVAL_MS = 3000;
const CHAT_INTERVAL_MS = 4000;
// How quickly the other side sees Start / In progress / Complete.
const STATUS_INTERVAL_MS = 4000;

// A phone reports a fix every second or so. Sending all of them would fill the
// trail with identical points and drain a battery for nothing, so a ping goes
// out once the vehicle has moved 25 metres — or every 10 seconds regardless,
// so a stationary car still proves it is still there.
const MIN_PING_DISTANCE_M = 25;
const MAX_PING_GAP_MS = 10000;

const GPS_ERRORS = {
  1: "Location permission was denied. Allow it to share your position with your passengers.",
  2: "Your position is unavailable right now — check that location services are on.",
  3: "Getting a GPS fix is taking longer than usual. Still trying.",
};

/** Metres between two coordinates. Equirectangular: exact enough under a km. */
function metresBetween(aLat, aLng, bLat, bLng) {
  const R = 6371000;
  const rad = Math.PI / 180;
  const x = (bLng - aLng) * rad * Math.cos(((aLat + bLat) / 2) * rad);
  const y = (bLat - aLat) * rad;
  return Math.sqrt(x * x + y * y) * R;
}

const place = (label) => String(label ?? "").split(",")[0];
const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/**
 * The passenger's own leg of the trip.
 *
 * The map and the live strip both describe the driver's journey — where the
 * car started, when it reaches the destination. A rider needs a different
 * thing: where to stand, and how long until the car is there. "Arriving in 40
 * minutes" is the wrong number to act on if your pickup is the second stop.
 *
 * Shown to passengers only; the driver has the pickup plan instead.
 */
function YourJourney({ track, isLive, status }) {
  const pickup = track?.myPickup;
  if (!pickup) return null;

  const waiting = isLive && pickup.distanceKm != null && !pickup.arrived;
  const here = isLive && pickup.arrived;

  return (
    <div className="card mt-3 p-4">
      <div className="flex items-center gap-2">
        <MapPin size={15} className="text-violet-600" />
        <h2 className="text-[15px] font-semibold text-slate-900">Your journey</h2>
      </div>

      {/* The headline is whichever fact the person can act on right now. */}
      {here && (
        <p className="mt-2 rounded-lg bg-brand-50 px-3 py-2 text-sm font-medium text-brand-800">
          Your driver is at the pickup point. Look out for the car.
        </p>
      )}
      {waiting && (
        <p className="mt-2 rounded-lg bg-violet-50 px-3 py-2 text-sm font-medium text-violet-900">
          Reaching your pickup in about {pickup.etaMinutes} min · {pickup.distanceKm} km away
        </p>
      )}
      {!isLive && status === "PUBLISHED" && (
        <p className="mt-2 text-sm text-slate-500">
          Be at your pickup point a couple of minutes before the departure time.
        </p>
      )}

      <ol className="mt-3 space-y-3">
        <li className="flex gap-3">
          <span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-violet-600" />
          <span className="min-w-0">
            <span className="block text-[11px] font-bold uppercase tracking-wider text-slate-500">
              You get on
            </span>
            <span className="block text-[15px] text-slate-900">{pickup.label}</span>
          </span>
        </li>
        {track?.myDrop && (
          <li className="flex gap-3">
            <span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-rose-600" />
            <span className="min-w-0">
              <span className="block text-[11px] font-bold uppercase tracking-wider text-slate-500">
                You get off
              </span>
              <span className="block text-[15px] text-slate-900">{track.myDrop.label}</span>
            </span>
          </li>
        )}
      </ol>

      {/* Walking directions are the one thing this app should not try to own —
          the phone's own maps app already does it, knows the footpaths, and is
          what someone will follow while actually walking. */}
      <a
        href={`https://www.google.com/maps/dir/?api=1&destination=${pickup.lat},${pickup.lng}&travelmode=walking`}
        target="_blank"
        rel="noreferrer"
        className="btn-secondary btn-sm mt-3 w-full"
      >
        <Navigation size={14} />
        Directions to your pickup
      </a>
    </div>
  );
}

/**
 * Turns the trip state machine into one plain sentence.
 *
 * The same person drives on some trips and rides on others, so the wording has
 * to change with the side they are on: a driver is told who to collect, a rider
 * is told who is collecting them.
 */
function nextStepFor({ isDriver, ride, riders, myBooking }) {
  if (ride.status === "CANCELLED") {
    return { tone: "info", text: "This trip was cancelled." };
  }

  if (isDriver) {
    switch (ride.status) {
      case "PUBLISHED":
        return riders.length === 0
          ? {
              tone: "waiting",
              text: `Waiting for colleagues to book. ${ride.seatsLeft} of ${ride.totalSeats} seats still open.`,
            }
          : {
              tone: "action",
              text: `Collect ${riders.map((b) => b.passenger.name.split(" ")[0]).join(", ")} at ${place(riders[0].pickupLabel)}, then tap Start trip.`,
            };
      case "STARTED":
        return {
          tone: "action",
          text: `Drive to the pickup point. Tap Mark in progress once everyone is aboard.`,
        };
      case "IN_PROGRESS":
        return {
          tone: "action",
          text: `Head to ${place(ride.destLabel)}. Tap Complete trip when you arrive.`,
        };
      case "COMPLETED":
        return {
          tone: "info",
          text:
            riders.length > 0
              ? `Trip finished. ${riders.length} ${riders.length === 1 ? "rider" : "riders"} will settle the fare.`
              : "Trip finished.",
        };
      default:
        return { tone: "info", text: "" };
    }
  }

  const driverFirstName = ride.driver.name.split(" ")[0];

  switch (ride.status) {
    case "PUBLISHED":
      return {
        tone: "info",
        text: `Be at ${place(myBooking?.pickupLabel ?? ride.originLabel)} for ${when(ride.departureAt)}. ${driverFirstName} will pick you up.`,
      };
    case "STARTED":
      return { tone: "waiting", text: `${driverFirstName} has set off and is heading to your pickup point.` };
    case "IN_PROGRESS":
      return { tone: "waiting", text: `On the way to ${place(ride.destLabel)}.` };
    case "COMPLETED":
      return myBooking?.payment?.status === "COMPLETED"
        ? { tone: "info", text: "Trip complete and paid. Nothing left to do." }
        : {
            tone: "action",
            text: `Trip complete. Pay ${money(myBooking?.fareAmount ?? 0)} to close it off.`,
          };
    default:
      return { tone: "info", text: "" };
  }
}

export default function TripDetail() {
  const { rideId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [ride, setRide] = useState(null);
  const [track, setTrack] = useState(null);
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [shareUrl, setShareUrl] = useState("");
  const [copied, setCopied] = useState(false);
  const [repeatNote, setRepeatNote] = useState("");
  const [simulating, setSimulating] = useState(false);
  // How many route points the stand-in covers per tick. A real journey takes
  // one to two minutes to walk end to end, which is a long time to watch a dot
  // while explaining it, so the pace can be raised without changing how often
  // it reports — the ping rate stays the same, each ping just moves further.
  const [simSpeed, setSimSpeed] = useState(1);
  const [gpsError, setGpsError] = useState("");

  const chatEndRef = useRef(null);

  const loadRide = useCallback(async () => {
    try {
      setRide((await get(`/rides/${rideId}`)).ride);
    } catch (err) {
      setError(err.message);
    }
  }, [rideId]);

  useEffect(() => {
    loadRide();
  }, [loadRide]);

  // The driver advances the trip; everyone else finds out by asking. Without
  // this a passenger sits on "Open" until they refresh, even though the car
  // has already left. Stops once the trip reaches a state that cannot change.
  useEffect(() => {
    if (!ride) return;
    if (["COMPLETED", "CANCELLED"].includes(ride.status)) return;

    const id = setInterval(loadRide, STATUS_INTERVAL_MS);
    return () => clearInterval(id);
  }, [ride?.status, loadRide]);

  const isDriver = ride && user && ride.driverId === user.id;
  const isLive = ride && ["STARTED", "IN_PROGRESS"].includes(ride.status);

  // Pulled out as primitives so effects can depend on the route itself rather
  // than on the ride object, which the status poll replaces every few seconds.
  const routeGeometry = ride?.routeGeometry;
  const originLat = ride?.originLat;
  const originLng = ride?.originLng;
  const destLat = ride?.destLat;
  const destLng = ride?.destLng;

  // Poll the vehicle position only while the trip is actually running.
  useEffect(() => {
    if (!isLive) return;

    let alive = true;
    const tick = () =>
      get(`/rides/${rideId}/track`)
        .then((d) => alive && setTrack(d))
        .catch(() => {});

    tick();
    const id = setInterval(tick, TRACK_INTERVAL_MS);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [rideId, isLive]);

  /**
   * Walks the vehicle along its own route, one step every couple of seconds.
   *
   * A device sitting on a desk reports the same coordinates forever, so on a
   * laptop there is nothing for tracking to show. This drives the same ping
   * endpoint the real GPS uses — it is a stand-in for movement, not a stand-in
   * for the feature, and it is labelled as such in the interface.
   */
  useEffect(() => {
    // Guarded on the endpoints, not on the geometry: a ride published while
    // the routing service was unreachable has no polyline at all, and those
    // are exactly the rides that still need to be demonstrable. The
    // straight-line fallback below covers them.
    if (!simulating || !isDriver || !isLive || originLat == null || destLat == null) return;

    const path = decodePolyline(routeGeometry);
    // No road geometry (routing was unavailable): interpolate the straight line.
    const points =
      path.length > 1
        ? path
        : Array.from({ length: 40 }, (_, i) => {
            const t = i / 39;
            return [originLat + (destLat - originLat) * t, originLng + (destLng - originLng) * t];
          });

    const stride = Math.max(1, Math.round(points.length / 60)) * simSpeed;

    let i = Math.floor(points.length * 0.05);
    const id = setInterval(() => {
      if (i >= points.length) return clearInterval(id);
      const [lat, lng] = points[i];
      // Reported speed follows the stride, so a sped-up run does not claim to
      // be crawling at 32 km/h while covering four times the ground — the ETA
      // is derived from this and would contradict what is on screen.
      post(`/rides/${rideId}/ping`, { lat, lng, speedKmph: 32 * simSpeed }).catch(() => {});
      i += stride;
    }, 2000);

    return () => clearInterval(id);
    // Depends on the route's coordinates, never on the ride object.
    //
    // The status poll replaces that object every few seconds, and depending on
    // it tore this interval down and rebuilt it each time — which reset the
    // walk to its starting index, so the vehicle pinged the same spot forever
    // and the marker never moved. These are primitives and stay stable while
    // the trip is the same trip.
  }, [
    simulating,
    simSpeed,
    isDriver,
    isLive,
    rideId,
    routeGeometry,
    originLat,
    originLng,
    destLat,
    destLng,
  ]);

  /**
   * The driver's device is the source of truth for position.
   *
   * `maximumAge: 0` forces a fresh fix rather than letting the browser hand
   * back a cached one — a cached position is what makes a marker sit still for
   * a minute and then jump a kilometre.
   *
   * Fixes arrive far faster than they are worth sending, so a ping goes out
   * only when the vehicle has actually moved or enough time has passed. That
   * keeps the trail meaningful instead of a pile of identical points, and stops
   * a phone with a jittery fix hammering the endpoint while parked.
   */
  useEffect(() => {
    if (!isDriver || !isLive || !navigator.geolocation || simulating) return;

    let lastSent = { lat: null, lng: null, at: 0 };

    const watchId = navigator.geolocation.watchPosition(
      ({ coords, timestamp }) => {
        // A fix good to worse than 200 m is cell-tower positioning, not GPS.
        // Plotting it would move the marker somewhere the car has never been.
        if (coords.accuracy != null && coords.accuracy > 200) return;

        const movedM =
          lastSent.lat == null
            ? Infinity
            : metresBetween(lastSent.lat, lastSent.lng, coords.latitude, coords.longitude);
        const sinceMs = timestamp - lastSent.at;

        if (movedM < MIN_PING_DISTANCE_M && sinceMs < MAX_PING_GAP_MS) return;
        lastSent = { lat: coords.latitude, lng: coords.longitude, at: timestamp };

        post(`/rides/${rideId}/ping`, {
          lat: coords.latitude,
          lng: coords.longitude,
          // The Geolocation API reports metres per second; the rest of the
          // product speaks km/h. A negative value means "unknown".
          speedKmph: coords.speed != null && coords.speed >= 0 ? coords.speed * 3.6 : undefined,
          heading: coords.heading != null && !Number.isNaN(coords.heading) ? coords.heading : undefined,
          accuracyM: coords.accuracy ?? undefined,
        }).catch(() => {});
      },
      (err) => setGpsError(GPS_ERRORS[err.code] ?? "Location is unavailable on this device."),
      { enableHighAccuracy: true, maximumAge: 0, timeout: 15000 }
    );

    return () => navigator.geolocation.clearWatch(watchId);
    // `simulating` belongs here: without it, turning the simulator on left the
    // real watch running, and two sources fought over the same ping endpoint.
  }, [rideId, isDriver, isLive, simulating]);

  useEffect(() => {
    if (!showChat) return;

    let alive = true;
    const tick = () =>
      get(`/rides/${rideId}/messages`)
        .then((d) => alive && setMessages(d.messages))
        .catch(() => {});

    tick();
    const id = setInterval(tick, CHAT_INTERVAL_MS);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [rideId, showChat]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  const advance = async () => {
    setBusy(true);
    setError("");
    try {
      setRide((await post(`/rides/${rideId}/advance`, {})).ride);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const generateNext = async () => {
    setBusy(true);
    setError("");
    try {
      const { created, skipped } = await post(`/rides/${rideId}/repeat`, { weeks: 2 });
      setRepeatNote(
        created > 0 ? `${created} ride${created === 1 ? "" : "s"} created` : `Already scheduled (${skipped})`
      );
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const cancel = async () => {
    const asDriver = ride.driverId === user.id;
    const message = asDriver
      ? `Cancel this ride? ${riders.length} ${riders.length === 1 ? "person loses their" : "people lose their"} seat.`
      : "Cancel your seat on this ride?";
    if (!confirm(message)) return;

    setBusy(true);
    setError("");
    try {
      await post(asDriver ? `/rides/${rideId}/cancel` : `/bookings/${myBooking.id}/cancel`, {});
      navigate("/trips");
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  const share = async () => {
    try {
      const { shareToken } = await post(`/rides/${rideId}/share`, {});
      const url = `${location.origin}/track/${shareToken}`;
      setShareUrl(url);

      // Native share sheet on a phone, clipboard everywhere else.
      if (navigator.share) {
        await navigator.share({ title: "Follow my trip", url }).catch(() => {});
      } else {
        await navigator.clipboard.writeText(url).catch(() => {});
        setCopied(true);
        setTimeout(() => setCopied(false), 2500);
      }
    } catch (err) {
      setError(err.message);
    }
  };

  const send = async (e) => {
    e.preventDefault();
    const body = draft.trim();
    if (!body) return;

    setDraft("");
    try {
      const { message } = await post(`/rides/${rideId}/messages`, { body });
      setMessages((m) => [...m, message]);
    } catch (err) {
      setError(err.message);
    }
  };

  if (!ride) return error ? <Banner>{error}</Banner> : <Spinner label="Loading trip" />;

  const riders = ride.bookings.filter((b) => b.status !== "CANCELLED");
  const myBooking = riders.find((b) => b.passengerId === user.id);
  const counterpart = isDriver ? riders[0]?.passenger : ride.driver;

  const NEXT_LABEL = { PUBLISHED: "Start trip", STARTED: "Mark in progress", IN_PROGRESS: "Complete trip" };
  const nextAction = NEXT_LABEL[ride.status];
  const guidance = nextStepFor({ isDriver, ride, riders, myBooking });

  return (
    <div className="mx-auto max-w-2xl">
      <button
        onClick={() => navigate("/trips")}
        className="mb-3 inline-flex items-center gap-1.5 text-sm text-slate-600"
      >
        <ArrowLeft size={16} />
        Trips
      </button>

      <div className="flex items-center gap-2">
        <RoleBadge role={isDriver ? "driving" : "riding"} />
        <StatusChip status={ride.status} />
        {ride.womenOnly && <WomenOnlyBadge size="sm" />}
      </div>

      <h1 className="mt-2 text-xl font-semibold tracking-tight text-slate-900">
        {ride.originLabel.split(",")[0]} to {ride.destLabel.split(",")[0]}
      </h1>
      <p className="mt-1 text-sm text-slate-500">{when(ride.departureAt)}</p>

      <div className="mt-3">
        <NextStep tone={guidance.tone}>{guidance.text}</NextStep>
      </div>

      {/* Only the driver can act on this, and only while it matters. A
          passenger seeing "location permission denied" would have no idea
          whose permission was being talked about. */}
      {isDriver && isLive && gpsError && !simulating && (
        <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-sm text-amber-800">
          {gpsError}
        </div>
      )}

      <MapView
        origin={{ lat: ride.originLat, lng: ride.originLng }}
        dest={{ lat: ride.destLat, lng: ride.destLng }}
        geometry={ride.routeGeometry}
        vehicle={track?.position}
        pickup={track?.myPickup}
        className="mt-4 h-60 w-full sm:h-80"
      />

      {!isDriver && <YourJourney track={track} isLive={isLive} status={ride.status} />}

      {isLive && (
        <div className="card mt-3 flex items-center gap-3 border-brand-200 bg-brand-50 p-3">
          <span className="relative flex h-2.5 w-2.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand-500 opacity-75" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-brand-600" />
          </span>
          <div className="min-w-0 flex-1 text-sm">
            <span className="font-medium text-brand-800">
              {track?.etaMinutes ? `Arriving in about ${track.etaMinutes} min` : "Trip in progress"}
            </span>

            {!track?.position ? (
              <span className="block text-xs text-brand-700">Waiting for the driver's location</span>
            ) : (
              <span className="block text-xs text-brand-700">
                {track.remainingKm != null && `${track.remainingKm} km to go · `}
                {track.position.speedKmph > 1 && `${Math.round(track.position.speedKmph)} km/h · `}
                {/* Read from the server's clock, so a device with the wrong
                    time cannot report a fix as minutes old or in the future. */}
                {track.fixAgeSeconds != null
                  ? track.fixAgeSeconds < 60
                    ? `updated ${track.fixAgeSeconds}s ago`
                    : `updated ${Math.round(track.fixAgeSeconds / 60)} min ago`
                  : ""}
              </span>
            )}

            {/* A weak fix is called out rather than left to look like the app
                losing the car. */}
            {track?.position?.accuracyM > 60 && (
              <span className="block text-xs text-amber-700">
                Weak GPS signal — position accurate to about{" "}
                {Math.round(track.position.accuracyM)} m
              </span>
            )}

            {track?.progressPercent != null && (
              <span className="mt-1.5 block h-1 w-full overflow-hidden rounded-full bg-brand-200">
                <span
                  className="block h-full rounded-full bg-brand-600 transition-[width] duration-700 ease-out"
                  style={{ width: `${track.progressPercent}%` }}
                />
              </span>
            )}
          </div>

          {/* Only the driver sends position, so only the driver can stand in
              for a moving vehicle. Labelled plainly so nobody mistakes the
              simulation for the real feed. */}
          {isDriver && (
            <div className="flex shrink-0 items-center gap-1.5">
              <button
                onClick={() => setSimulating((v) => !v)}
                className={`rounded-lg px-2.5 py-1.5 text-xs font-medium transition ${
                  simulating
                    ? "bg-brand-600 text-white"
                    : "bg-white text-brand-800 shadow-card hover:bg-brand-50"
                }`}
              >
                {simulating ? "Simulating…" : "Simulate driving"}
              </button>

              {/* Pace control, shown only once the stand-in is running. An
                  end-to-end run takes over a minute in real time, which is
                  longer than anyone wants to watch while talking over it. */}
              {simulating && (
                <span className="flex overflow-hidden rounded-lg bg-white shadow-card">
                  {[1, 4].map((s) => (
                    <button
                      key={s}
                      onClick={() => setSimSpeed(s)}
                      aria-label={`Simulate at ${s} times speed`}
                      className={`px-2 py-1.5 text-xs font-semibold transition ${
                        simSpeed === s
                          ? "bg-brand-100 text-brand-800"
                          : "text-slate-500 hover:bg-slate-50"
                      }`}
                    >
                      {s}×
                    </button>
                  ))}
                </span>
              )}
            </div>
          )}
          <button
            onClick={share}
            className="inline-flex items-center gap-1.5 rounded-lg bg-white px-2.5 py-1.5 text-xs font-medium text-brand-800 shadow-card"
          >
            {copied ? <Check size={13} /> : <Share2 size={13} />}
            {copied ? "Copied" : "Share"}
          </button>
        </div>
      )}

      {shareUrl && !copied && (
        <p className="mt-2 flex items-center gap-2 rounded-lg bg-slate-100 px-3 py-2 text-xs text-slate-600">
          <ShieldCheck size={13} className="shrink-0 text-brand-600" />
          <span className="truncate">{shareUrl}</span>
          <button
            onClick={() => navigator.clipboard.writeText(shareUrl)}
            className="ml-auto shrink-0 text-brand-700"
            aria-label="Copy link"
          >
            <Copy size={13} />
          </button>
        </p>
      )}

      {/* People on this trip */}
      <div className="card mt-3 divide-y divide-slate-100">
        <div className="flex items-center gap-3 p-4">
          <Avatar name={ride.driver.name} color={ride.driver.avatarColor} size={40} />
          <div className="min-w-0 flex-1">
            <div className="truncate font-medium text-slate-900">{ride.driver.name}</div>
            <div className="text-xs text-slate-500">
              Driver · {ride.vehicle.model} · {ride.vehicle.registrationNumber}
            </div>
          </div>
          {!isDriver && (
            <div className="flex gap-1.5">
              {ride.driver.phone && (
                <a
                  href={`tel:${ride.driver.phone}`}
                  aria-label="Call driver"
                  className="flex h-10 w-10 items-center justify-center rounded-lg border border-slate-300 text-slate-600"
                >
                  <Phone size={16} />
                </a>
              )}
              <button
                onClick={() => setShowChat(true)}
                aria-label="Message driver"
                className="flex h-10 w-10 items-center justify-center rounded-lg border border-slate-300 text-slate-600"
              >
                <MessageSquare size={16} />
              </button>
            </div>
          )}
        </div>

        {isDriver &&
          riders.map((b) => (
            <div key={b.id} className="flex items-center gap-3 p-4">
              <Avatar name={b.passenger.name} color={b.passenger.avatarColor} size={40} />
              <div className="min-w-0 flex-1">
                <div className="truncate font-medium text-slate-900">{b.passenger.name}</div>
                <div className="truncate text-xs text-slate-500">
                  {b.seats} {b.seats === 1 ? "seat" : "seats"} · pickup {b.pickupLabel.split(",")[0]}
                </div>
              </div>
              <div className="flex gap-1.5">
                {b.passenger.phone && (
                  <a
                    href={`tel:${b.passenger.phone}`}
                    aria-label={`Call ${b.passenger.name}`}
                    className="flex h-10 w-10 items-center justify-center rounded-lg border border-slate-300 text-slate-600"
                  >
                    <Phone size={16} />
                  </a>
                )}
                <button
                  onClick={() => setShowChat(true)}
                  aria-label="Open chat"
                  className="flex h-10 w-10 items-center justify-center rounded-lg border border-slate-300 text-slate-600"
                >
                  <MessageSquare size={16} />
                </button>
              </div>
            </div>
          ))}
      </div>

      {isDriver && riders.length > 1 && <PickupPlan rideId={rideId} />}

      {!isDriver && myBooking && ride.status === "COMPLETED" && (
        <RateDriver rideId={rideId} driverName={ride.driver.name} />
      )}

      {isDriver && ride.isRecurring && ride.recurrenceDays?.length > 0 && (
        <div className="card mt-3 flex flex-wrap items-center gap-3 p-4">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <Repeat size={15} className="text-brand-600" />
              <span className="text-[15px] font-medium text-slate-900">Weekly commute</span>
            </div>
            <p className="mt-0.5 text-xs text-slate-500">
              Repeats every {ride.recurrenceDays.map((d) => DAY_NAMES[d]).join(", ")}
            </p>
          </div>
          <button
            onClick={generateNext}
            disabled={busy}
            className="btn-secondary btn-sm shrink-0"
          >
            {repeatNote || "Create next 2 weeks"}
          </button>
        </div>
      )}

      {/* Fare */}
      <div className="card mt-3 p-4">
        <div className="flex items-center justify-between">
          <span className="text-sm text-slate-600">
            {isDriver ? "Fare per seat" : "Your fare"}
          </span>
          <span className="text-lg font-semibold text-slate-900">
            {money(myBooking ? myBooking.fareAmount : ride.farePerSeat)}
          </span>
        </div>
        <div className="mt-1 text-xs text-slate-500">
          {ride.distanceKm} km · {ride.durationMin} min
        </div>
      </div>

      <div className="mt-4">
        <Banner>{error}</Banner>
      </div>

      {/* Primary action.
          Deliberately in normal flow: a sticky bar floats over whatever is
          behind it, which on this screen meant covering the rider list and
          fare. The page is short enough that the button is reachable without
          pinning it. */}
      <div className="mt-5 space-y-2">
        {isDriver && nextAction && (
          <button className="btn-primary w-full shadow-lift" onClick={advance} disabled={busy}>
            {ride.status === "IN_PROGRESS" ? <Flag size={17} /> : <Play size={17} />}
            {busy ? "Updating" : nextAction}
          </button>
        )}

        {!isDriver && myBooking && ride.status === "COMPLETED" && myBooking.payment?.status !== "COMPLETED" && (
          <button
            className="btn-primary w-full shadow-lift"
            onClick={() => navigate(`/pay/${myBooking.id}`)}
          >
            Pay {money(myBooking.fareAmount)}
          </button>
        )}

        {!isDriver && isLive && (
          <button className="btn-secondary w-full shadow-lift" onClick={share}>
            <Navigation size={16} />
            Share live location with family
          </button>
        )}

        {/* Available to everyone in the car, driver included — whoever is in
            trouble is not decided by who is holding the wheel. Only while the
            trip is actually running, since that is the window the alert can
            say anything useful about where someone is. */}
        {isLive && <SosButton rideId={rideId} />}

        {/* Cancelling is only possible before the trip starts — once wheels are
            moving the seat has already been used. */}
        {ride.status === "PUBLISHED" && (isDriver || myBooking) && (
          <button
            onClick={cancel}
            disabled={busy}
            className="w-full rounded-xl py-2.5 text-sm font-medium text-rose-600 transition hover:bg-rose-50"
          >
            {isDriver ? "Cancel this ride" : "Cancel my seat"}
          </button>
        )}
      </div>

      <Sheet open={showChat} onClose={() => setShowChat(false)} title={`Chat with ${counterpart?.name ?? "trip"}`}>
        <div className="flex max-h-[55vh] min-h-[240px] flex-col">
          <div className="flex-1 space-y-2 overflow-y-auto pb-2">
            {messages.length === 0 && (
              <p className="py-8 text-center text-sm text-slate-500">
                No messages yet. Say hello or share where you are waiting.
              </p>
            )}
            {messages.map((m) => {
              const mine = m.senderId === user.id;
              return (
                <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                  <div
                    className={`max-w-[80%] rounded-2xl px-3 py-2 text-[15px] ${
                      mine
                        ? "rounded-br-sm bg-brand-600 text-white"
                        : "rounded-bl-sm bg-slate-100 text-slate-800"
                    }`}
                  >
                    {!mine && (
                      <div className="mb-0.5 text-[11px] font-medium text-slate-500">
                        {m.sender.name}
                      </div>
                    )}
                    {m.body}
                  </div>
                </div>
              );
            })}
            <div ref={chatEndRef} />
          </div>

          <form onSubmit={send} className="flex gap-2 border-t border-slate-200 pt-3">
            <input
              className="field"
              placeholder="Message"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
            />
            <button className="btn-primary px-3" aria-label="Send" disabled={!draft.trim()}>
              <Send size={16} />
            </button>
          </form>
        </div>
      </Sheet>
    </div>
  );
}
