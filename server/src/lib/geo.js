// Routing helpers. OSRM's public demo server is free and keyless, but it is a
// shared demo box — it can rate-limit or be unreachable on venue wifi. Live
// Trip Tracking is a mandatory feature, so every call here degrades to a
// straight-line estimate rather than throwing.

const OSRM = process.env.OSRM_URL || "https://router.project-osrm.org";

const R_KM = 6371;
const toRad = (d) => (d * Math.PI) / 180;

export function haversineKm(aLat, aLng, bLat, bLng) {
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R_KM * Math.asin(Math.sqrt(s));
}

/**
 * Road route between two points.
 * @returns {{distanceKm:number, durationMin:number, geometry:string|null, source:"osrm"|"fallback"}}
 */
export async function getRoute(origin, dest) {
  const coords = `${origin.lng},${origin.lat};${dest.lng},${dest.lat}`;
  const url = `${OSRM}/route/v1/driving/${coords}?overview=full&geometries=polyline`;

  try {
    // Hard timeout: a hanging map service must never hang a ride publish.
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 6000);
    const res = await fetch(url, { signal: ctrl.signal });
    clearTimeout(timer);

    if (!res.ok) throw new Error(`OSRM ${res.status}`);
    const data = await res.json();
    const route = data.routes?.[0];
    if (!route) throw new Error("no route in OSRM response");

    return {
      distanceKm: round2(route.distance / 1000),
      durationMin: Math.max(1, Math.round(route.duration / 60)),
      geometry: route.geometry,
      source: "osrm",
    };
  } catch (err) {
    console.warn("[geo] OSRM unavailable, using haversine fallback:", err.message);
    const straight = haversineKm(origin.lat, origin.lng, dest.lat, dest.lng);
    // Roads are never straight: 1.3x is the usual detour factor for city driving.
    const distanceKm = round2(straight * 1.3);
    return {
      distanceKm,
      // ~28 km/h average city speed.
      durationMin: Math.max(1, Math.round((distanceKm / 28) * 60)),
      geometry: null,
      source: "fallback",
    };
  }
}

function round2(n) {
  return Math.round(n * 100) / 100;
}
