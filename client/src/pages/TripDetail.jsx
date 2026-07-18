import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  Check,
  Copy,
  MessageSquare,
  Navigation,
  Phone,
  Play,
  Send,
  Share2,
  ShieldCheck,
  Flag,
} from "lucide-react";
import { get, post } from "../lib/api";
import { useAuth } from "../lib/auth";
import MapView from "../components/MapView";
import { Avatar, Banner, Sheet, Spinner, StatusChip, money, when } from "../components/ui";

// Live tracking polls rather than holding a socket open: nothing to reconnect,
// no dropped connection mid-demo, and it behaves the same on every host.
const TRACK_INTERVAL_MS = 3000;
const CHAT_INTERVAL_MS = 4000;

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

  const isDriver = ride && user && ride.driverId === user.id;
  const isLive = ride && ["STARTED", "IN_PROGRESS"].includes(ride.status);

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

  // The driver's device is the source of truth for position.
  useEffect(() => {
    if (!isDriver || !isLive || !navigator.geolocation) return;

    const watchId = navigator.geolocation.watchPosition(
      ({ coords }) => {
        post(`/rides/${rideId}/ping`, {
          lat: coords.latitude,
          lng: coords.longitude,
          speedKmph: coords.speed != null ? coords.speed * 3.6 : undefined,
          heading: coords.heading ?? undefined,
        }).catch(() => {});
      },
      () => {},
      { enableHighAccuracy: true, maximumAge: 2000, timeout: 10000 }
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, [rideId, isDriver, isLive]);

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

  return (
    <div className="mx-auto max-w-2xl">
      <button
        onClick={() => navigate("/trips")}
        className="mb-3 inline-flex items-center gap-1.5 text-sm text-slate-600"
      >
        <ArrowLeft size={16} />
        Trips
      </button>

      <div className="flex items-center justify-between gap-3">
        <h1 className="text-xl font-semibold tracking-tight text-slate-900">
          {ride.originLabel.split(",")[0]} to {ride.destLabel.split(",")[0]}
        </h1>
        <StatusChip status={ride.status} />
      </div>
      <p className="mt-1 text-sm text-slate-500">{when(ride.departureAt)}</p>

      <MapView
        origin={{ lat: ride.originLat, lng: ride.originLng }}
        dest={{ lat: ride.destLat, lng: ride.destLng }}
        geometry={ride.routeGeometry}
        vehicle={track?.position}
        className="mt-4 h-60 w-full sm:h-80"
      />

      {isLive && (
        <div className="card mt-3 flex items-center gap-3 border-brand-200 bg-brand-50 p-3">
          <span className="relative flex h-2.5 w-2.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand-500 opacity-75" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-brand-600" />
          </span>
          <div className="flex-1 text-sm">
            <span className="font-medium text-brand-800">
              {track?.etaMinutes ? `Arriving in about ${track.etaMinutes} min` : "Trip in progress"}
            </span>
            {!track?.position && (
              <span className="block text-xs text-brand-700">Waiting for the driver's location</span>
            )}
          </div>
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

      {/* Primary action */}
      <div className="sticky bottom-20 mt-4 md:bottom-4">
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
