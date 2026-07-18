import { useEffect, useMemo, useRef, useState } from "react";
import { MapContainer, TileLayer, Marker, Polyline, useMap } from "react-leaflet";
import L from "leaflet";
import { decodePolyline } from "../lib/polyline";

// Leaflet's default marker images break under bundlers. Inline SVG divIcons
// avoid that and let the pins match the app's palette.
const pin = (fill, ring) =>
  L.divIcon({
    className: "",
    iconSize: [24, 30],
    iconAnchor: [12, 30],
    html: `<svg width="24" height="30" viewBox="0 0 24 30" fill="none">
      <path d="M12 0C5.9 0 1 4.9 1 11c0 8 11 19 11 19s11-11 11-19c0-6.1-4.9-11-11-11z"
            fill="${fill}" stroke="#fff" stroke-width="2"/>
      <circle cx="12" cy="11" r="4" fill="${ring}"/>
    </svg>`,
  });

const ORIGIN_ICON = pin("#286b57", "#ffffff");
const DEST_ICON = pin("#b91c1c", "#ffffff");

// The live vehicle marker: a filled dot with a soft halo, the convention every
// rider already understands from maps apps.
const VEHICLE_ICON = L.divIcon({
  className: "",
  iconSize: [22, 22],
  iconAnchor: [11, 11],
  html: `<div style="width:22px;height:22px;border-radius:50%;background:#286b57;
    border:3px solid #fff;box-shadow:0 0 0 6px rgba(40,107,87,.18),0 1px 4px rgba(0,0,0,.25)"></div>`,
});

/**
 * Slides the vehicle marker between fixes instead of teleporting it.
 *
 * Position arrives every few seconds, so a plain marker jumps in visible
 * steps and reads as a stuttering app rather than a moving car. This walks
 * the marker from where it was to where it now is over roughly one poll
 * interval, which is what every maps app does and what makes tracking look
 * live rather than sampled.
 *
 * A jump of more than ~2 km is a GPS correction, not travel, so it is taken
 * instantly — animating it would send the marker gliding across the city.
 */
function useSmoothedPosition(target) {
  const [shown, setShown] = useState(target);
  const frame = useRef(null);

  useEffect(() => {
    if (!target) {
      setShown(null);
      return;
    }
    setShown((from) => {
      if (!from) return target;

      const far =
        Math.abs(target[0] - from[0]) > 0.02 || Math.abs(target[1] - from[1]) > 0.02;
      if (far) return target;

      const start = performance.now();
      const DURATION = 2800;
      const step = (now) => {
        const t = Math.min(1, (now - start) / DURATION);
        // Ease-out: quick off the mark, settling into the new position.
        const e = 1 - Math.pow(1 - t, 3);
        setShown([from[0] + (target[0] - from[0]) * e, from[1] + (target[1] - from[1]) * e]);
        if (t < 1) frame.current = requestAnimationFrame(step);
      };
      frame.current = requestAnimationFrame(step);
      return from;
    });

    return () => frame.current && cancelAnimationFrame(frame.current);
    // Keyed on the coordinates rather than the array, which is rebuilt on
    // every poll even when the car has not moved.
  }, [target?.[0], target?.[1]]);

  return shown;
}

function FitBounds({ points }) {
  const map = useMap();

  useEffect(() => {
    const valid = points.filter((p) => Array.isArray(p) && Number.isFinite(p[0]));
    if (valid.length === 0) return;

    // Animated rather than a hard jump. Once the user has zoomed themselves,
    // refitting on every position update would fight them, so only the first
    // fit animates from far out.
    if (valid.length === 1) {
      map.flyTo(valid[0], 14, { duration: 0.8 });
    } else {
      map.flyToBounds(L.latLngBounds(valid), { padding: [40, 40], duration: 0.8 });
    }
    // Depends on the joined coordinates, not the array identity, so a re-render
    // with the same positions does not re-animate the map.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, JSON.stringify(points)]);

  return null;
}

export default function MapView({ origin, dest, geometry, vehicle, className = "" }) {
  const route = useMemo(() => decodePolyline(geometry), [geometry]);

  const originPt = origin && [origin.lat, origin.lng];
  const destPt = dest && [dest.lat, dest.lng];
  const vehicleTarget = useMemo(
    () => (vehicle ? [vehicle.lat, vehicle.lng] : null),
    [vehicle?.lat, vehicle?.lng]
  );
  const vehiclePt = useSmoothedPosition(vehicleTarget);

  // Without geometry (routing unreachable) draw a dashed straight line so the
  // map still communicates the journey instead of looking broken.
  const fallbackLine = !route.length && originPt && destPt ? [originPt, destPt] : null;

  return (
    <div className={`overflow-hidden rounded-xl2 border border-slate-200 ${className}`}>
      <MapContainer
        center={originPt || [23.0273, 72.5075]}
        zoom={12}
        // Wheel zoom on, tuned so one notch is a small step rather than a
        // jarring jump, and half-level snapping so it glides instead of
        // clicking between integers.
        scrollWheelZoom
        wheelPxPerZoomLevel={140}
        wheelDebounceTime={20}
        // Fine snapping keeps wheel zoom smooth; the +/- buttons and keyboard
        // still move a whole level, which is what people expect from them.
        zoomSnap={0.25}
        zoomDelta={1}
        zoomAnimation
        markerZoomAnimation
        fadeAnimation
        inertia
        inertiaDeceleration={2500}
        style={{ height: "100%", width: "100%" }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {route.length > 0 && (
          <>
            {/* Casing under the line keeps it legible over busy map tiles. */}
            <Polyline positions={route} color="#ffffff" weight={8} opacity={0.9} />
            <Polyline positions={route} color="#286b57" weight={4} opacity={1} />
          </>
        )}
        {fallbackLine && (
          <Polyline positions={fallbackLine} color="#286b57" weight={3} dashArray="6 8" opacity={0.75} />
        )}

        {originPt && <Marker position={originPt} icon={ORIGIN_ICON} />}
        {destPt && <Marker position={destPt} icon={DEST_ICON} />}
        {vehiclePt && <Marker position={vehiclePt} icon={VEHICLE_ICON} />}

        {/* Fitted against the reported position, not the animated one. The
            smoothed value changes on every frame, so passing it here would
            re-fly the map sixty times a second and fight its own animation. */}
        <FitBounds points={[originPt, destPt, vehicleTarget, ...route].filter(Boolean)} />
      </MapContainer>
    </div>
  );
}
