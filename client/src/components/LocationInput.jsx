import { useEffect, useRef, useState } from "react";
import { Loader2, MapPin, Star } from "lucide-react";
import { get } from "../lib/api";

/**
 * Location picker backed by Nominatim (through our server proxy) plus the
 * user's saved places. Nominatim allows roughly one request per second, so
 * typing is debounced and in-flight requests are aborted. Saved places stay
 * available even when geocoding is rate limited or offline.
 */
export default function LocationInput({ value, onChange, placeholder, savedPlaces = [] }) {
  const [query, setQuery] = useState(value?.label ?? "");
  const [results, setResults] = useState([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  // Whether a search has come back for the current text, so "nothing found"
  // can be distinguished from "nothing searched for yet".
  const [searched, setSearched] = useState(false);
  const [notice, setNotice] = useState("");
  const abortRef = useRef(null);
  const boxRef = useRef(null);

  useEffect(() => {
    setQuery(value?.label ?? "");
  }, [value?.label]);

  useEffect(() => {
    const onClickAway = (e) => {
      if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", onClickAway);
    return () => document.removeEventListener("mousedown", onClickAway);
  }, []);

  useEffect(() => {
    if (query.length < 3 || query === value?.label) {
      setResults([]);
      setSearched(false);
      setNotice("");
      setLoading(false);
      return;
    }

    setLoading(true);
    const timer = setTimeout(async () => {
      abortRef.current?.abort();
      const ctrl = new AbortController();
      abortRef.current = ctrl;

      try {
        const data = await get(`/places/geocode?q=${encodeURIComponent(query)}`, {
          signal: ctrl.signal,
        });
        setResults(data.results ?? []);
        setSearched(true);
        setNotice(
          data.degraded
            ? "Place search is unavailable right now — pick a saved place, or try again shortly."
            : // Say so when the search had to be loosened, rather than quietly
              // showing results for something the person did not type.
              data.matchedQuery && data.matchedQuery.toLowerCase() !== query.trim().toLowerCase()
              ? `Showing results for "${data.matchedQuery}"`
              : ""
        );
      } catch (err) {
        // An abort is this component replacing its own request — not a
        // failure, and it must not blank a list the newer request just filled.
        if (err.name === "AbortError") return;
        setResults([]);
        setSearched(true);
        setNotice("Could not reach place search. Check your connection.");
      } finally {
        setLoading(false);
      }
    }, 450);

    return () => clearTimeout(timer);
  }, [query, value?.label]);

  const pick = (place) => {
    onChange({ label: place.label, lat: place.lat, lng: place.lng });
    setQuery(place.label);
    setOpen(false);
  };

  const matchingSaved = savedPlaces.filter(
    (p) => !query || p.label.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <div className="relative" ref={boxRef}>
      <div className="relative">
        <MapPin
          size={16}
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
        />
        <input
          className="field pl-9"
          placeholder={placeholder}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
        />
        {loading && (
          <Loader2
            size={15}
            className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-slate-400"
          />
        )}
      </div>

      {/* The panel also opens for "searching" and "nothing found". Rendering
          nothing at all was the old behaviour, and it left someone who typed a
          place that did not match staring at an empty box with no idea whether
          the app was working, still loading, or broken. */}
      {open &&
        (matchingSaved.length > 0 ||
          results.length > 0 ||
          notice ||
          (query.length >= 3 && (loading || searched))) && (
        <div className="absolute z-[1000] mt-1 w-full overflow-hidden rounded-xl2 border border-slate-200 bg-white shadow-lift">
          {notice && (
            <p className="border-b border-slate-100 bg-slate-50 px-3 py-2 text-xs text-slate-600">
              {notice}
            </p>
          )}

          {matchingSaved.length > 0 && (
            <div className="border-b border-slate-100">
              {matchingSaved.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => pick({ label: p.address, lat: p.lat, lng: p.lng })}
                  className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left hover:bg-slate-50"
                >
                  <Star size={15} className="shrink-0 text-amber-500" fill="currentColor" />
                  <span className="text-[15px] font-medium text-slate-800">{p.label}</span>
                  <span className="truncate text-xs text-slate-500">{p.address}</span>
                </button>
              ))}
            </div>
          )}

          {results.map((r, i) => (
            <button
              key={`${r.lat}-${r.lng}-${i}`}
              type="button"
              onClick={() => pick(r)}
              className="flex w-full items-start gap-2.5 px-3 py-2.5 text-left hover:bg-slate-50"
            >
              <MapPin size={15} className="mt-0.5 shrink-0 text-slate-400" />
              <span className="min-w-0">
                <span className="block truncate text-[15px] text-slate-800">{r.label}</span>
                <span className="block truncate text-xs text-slate-500">{r.fullLabel}</span>
              </span>
            </button>
          ))}

          {loading && results.length === 0 && (
            <p className="flex items-center gap-2 px-3 py-3 text-sm text-slate-500">
              <Loader2 size={14} className="animate-spin" />
              Searching for “{query}”…
            </p>
          )}

          {!loading && searched && results.length === 0 && matchingSaved.length === 0 && (
            <div className="px-3 py-3">
              <p className="text-sm font-medium text-slate-700">No places found for “{query}”</p>
              <p className="mt-0.5 text-xs text-slate-500">
                Try a shorter name — an area or landmark works better than a full address.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
