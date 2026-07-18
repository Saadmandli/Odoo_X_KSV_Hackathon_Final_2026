import { useEffect, useMemo } from "react";
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

function FitBounds({ points }) {
  const map = useMap();

  useEffect(() => {
    const valid = points.filter((p) => Array.isArray(p) && Number.isFinite(p[0]));
    if (valid.length === 0) return;

    if (valid.length === 1) map.setView(valid[0], 14);
    else map.fitBounds(L.latLngBounds(valid), { padding: [36, 36] });
  }, [map, points]);

  return null;
}

export default function MapView({ origin, dest, geometry, vehicle, className = "" }) {
  const route = useMemo(() => decodePolyline(geometry), [geometry]);

  const originPt = origin && [origin.lat, origin.lng];
  const destPt = dest && [dest.lat, dest.lng];
  const vehiclePt = vehicle && [vehicle.lat, vehicle.lng];

  // Without geometry (routing unreachable) draw a dashed straight line so the
  // map still communicates the journey instead of looking broken.
  const fallbackLine = !route.length && originPt && destPt ? [originPt, destPt] : null;

  return (
    <div className={`overflow-hidden rounded-xl2 border border-slate-200 ${className}`}>
      <MapContainer
        center={originPt || [23.0273, 72.5075]}
        zoom={12}
        scrollWheelZoom={false}
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

        <FitBounds points={[originPt, destPt, vehiclePt, ...route].filter(Boolean)} />
      </MapContainer>
    </div>
  );
}
