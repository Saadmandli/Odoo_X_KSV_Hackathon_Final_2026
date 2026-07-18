import { haversineKm } from "./geo.js";

/**
 * Orders passenger pickups along a ride.
 *
 * A driver with three riders can collect them in six different orders, and the
 * naive order (whoever booked first) can easily add 10+ km. This solves the
 * open travelling-salesman path from origin to destination with a greedy
 * nearest-neighbour pass, then improves it with 2-opt.
 *
 * Nearest-neighbour alone is typically 15-25% worse than optimal; adding 2-opt
 * brings it to within a few percent. With at most 8 seats the input is tiny, so
 * the exhaustive-ish improvement costs nothing and we avoid shipping an
 * approximation that visibly picks a silly route on stage.
 */
export function planPickups(origin, dest, stops) {
  if (stops.length <= 1) {
    return { order: stops, distanceKm: legLength(origin, stops, dest) };
  }

  // --- greedy nearest neighbour from the driver's starting point
  const remaining = [...stops];
  const order = [];
  let cursor = origin;

  while (remaining.length > 0) {
    let bestIndex = 0;
    let bestDist = Infinity;

    remaining.forEach((stop, i) => {
      const d = haversineKm(cursor.lat, cursor.lng, stop.lat, stop.lng);
      if (d < bestDist) {
        bestDist = d;
        bestIndex = i;
      }
    });

    cursor = remaining[bestIndex];
    order.push(remaining.splice(bestIndex, 1)[0]);
  }

  // --- 2-opt: repeatedly reverse a segment if doing so shortens the path
  let improved = true;
  let guard = 0;
  while (improved && guard++ < 50) {
    improved = false;

    for (let i = 0; i < order.length - 1; i++) {
      for (let k = i + 1; k < order.length; k++) {
        const candidate = [...order.slice(0, i), ...order.slice(i, k + 1).reverse(), ...order.slice(k + 1)];
        if (legLength(origin, candidate, dest) < legLength(origin, order, dest) - 0.001) {
          order.splice(0, order.length, ...candidate);
          improved = true;
        }
      }
    }
  }

  return { order, distanceKm: round2(legLength(origin, order, dest)) };
}

/** Total path length: origin -> each stop in order -> destination. */
function legLength(origin, stops, dest) {
  let total = 0;
  let prev = origin;

  for (const stop of stops) {
    total += haversineKm(prev.lat, prev.lng, stop.lat, stop.lng);
    prev = stop;
  }

  return total + haversineKm(prev.lat, prev.lng, dest.lat, dest.lng);
}

export const bookingOrderDistance = legLength;

const round2 = (n) => Math.round(n * 100) / 100;
