import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  CarFront,
  ChevronRight,
  ClipboardList,
  History,
  LifeBuoy,
  LogOut,
  Plus,
  Star,
  Trash2,
  Wallet,
} from "lucide-react";
import { del, get, post } from "../lib/api";
import { useAuth } from "../lib/auth";
import LocationInput from "../components/LocationInput";
import { Avatar, Banner, Sheet, Spinner } from "../components/ui";

const SHORTCUTS = [
  { to: "/trips", label: "My trips", icon: ClipboardList },
  { to: "/vehicles", label: "My vehicles", icon: CarFront },
  { to: "/wallet", label: "Wallet", icon: Wallet },
  { to: "/history", label: "Ride history", icon: History },
];

export default function Settings() {
  const { user, org, logout } = useAuth();
  const [places, setPlaces] = useState(null);
  const [showAdd, setShowAdd] = useState(false);
  const [label, setLabel] = useState("");
  const [location, setLocation] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const load = () => get("/places").then((d) => setPlaces(d.places)).catch((e) => setError(e.message));

  useEffect(() => {
    load();
  }, []);

  const add = async (e) => {
    e.preventDefault();
    if (!location) return setError("Search for the location first.");

    setBusy(true);
    setError("");
    try {
      await post("/places", {
        label: label.trim(),
        address: location.label,
        lat: location.lat,
        lng: location.lng,
      });
      await load();
      setShowAdd(false);
      setLabel("");
      setLocation(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const remove = async (place) => {
    try {
      await del(`/places/${place.id}`);
      await load();
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-xl font-semibold tracking-tight text-slate-900">Settings</h1>

      <div className="card mt-4 flex items-center gap-3 p-4">
        <Avatar name={user?.name} color={user?.avatarColor} size={48} />
        <div className="min-w-0">
          <div className="truncate font-medium text-slate-900">{user?.name}</div>
          <div className="truncate text-sm text-slate-500">{user?.email}</div>
          <div className="mt-0.5 text-xs text-brand-700">{org?.name}</div>
        </div>
      </div>

      <p className="mb-2 mt-6 px-1 text-xs font-medium uppercase tracking-wide text-slate-400">
        Shortcuts
      </p>
      <div className="card divide-y divide-slate-100">
        {SHORTCUTS.map(({ to, label, icon: Icon }) => (
          <Link key={to} to={to} className="flex items-center gap-3 p-4 hover:bg-slate-50">
            <Icon size={18} className="shrink-0 text-slate-400" />
            <span className="flex-1 text-[15px] text-slate-800">{label}</span>
            <ChevronRight size={16} className="shrink-0 text-slate-300" />
          </Link>
        ))}
      </div>

      <div className="mb-2 mt-6 flex items-center justify-between px-1">
        <span className="text-xs font-medium uppercase tracking-wide text-slate-400">
          Saved places
        </span>
        <button
          onClick={() => setShowAdd(true)}
          className="inline-flex items-center gap-1 text-sm font-medium text-brand-700"
        >
          <Plus size={14} />
          Add
        </button>
      </div>

      <Banner>{error}</Banner>

      {!places ? (
        <Spinner label="Loading places" />
      ) : places.length === 0 ? (
        <div className="card p-6 text-center text-sm text-slate-500">
          Save the places you travel between often so you do not have to type them each time.
        </div>
      ) : (
        <div className="card divide-y divide-slate-100">
          {places.map((p) => (
            <div key={p.id} className="flex items-center gap-3 p-4">
              <Star size={16} className="shrink-0 text-amber-500" fill="currentColor" />
              <div className="min-w-0 flex-1">
                <div className="text-[15px] font-medium text-slate-800">{p.label}</div>
                <div className="truncate text-xs text-slate-500">{p.address}</div>
              </div>
              <button
                onClick={() => remove(p)}
                aria-label={`Remove ${p.label}`}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-600"
              >
                <Trash2 size={15} />
              </button>
            </div>
          ))}
        </div>
      )}

      <p className="mb-2 mt-6 px-1 text-xs font-medium uppercase tracking-wide text-slate-400">
        Help
      </p>
      <div className="card divide-y divide-slate-100">
        <a href="mailto:support@northbridge.in" className="flex items-center gap-3 p-4 hover:bg-slate-50">
          <LifeBuoy size={18} className="shrink-0 text-slate-400" />
          <span className="flex-1 text-[15px] text-slate-800">Contact support</span>
          <ChevronRight size={16} className="shrink-0 text-slate-300" />
        </a>
        <button
          onClick={logout}
          className="flex w-full items-center gap-3 p-4 text-left hover:bg-rose-50"
        >
          <LogOut size={18} className="shrink-0 text-rose-500" />
          <span className="flex-1 text-[15px] text-rose-600">Sign out</span>
        </button>
      </div>

      <Sheet open={showAdd} onClose={() => !busy && setShowAdd(false)} title="Save a place">
        <form onSubmit={add} className="space-y-4">
          <div>
            <label className="label">Name</label>
            <input
              className="field"
              required
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Home, Office, Gym"
            />
          </div>

          <div>
            <label className="label">Location</label>
            <LocationInput
              value={location}
              onChange={setLocation}
              placeholder="Search for an address"
            />
          </div>

          <Banner>{error}</Banner>

          <button className="btn-primary w-full" disabled={busy}>
            {busy ? "Saving" : "Save place"}
          </button>
        </form>
      </Sheet>
    </div>
  );
}
