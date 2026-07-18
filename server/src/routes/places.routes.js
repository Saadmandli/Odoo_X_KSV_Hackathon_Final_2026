import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import * as V from "../lib/validation.js";
import { requireAuth, ah } from "../middleware/auth.js";
import { haversineKm } from "../lib/geo.js";

const router = Router();
router.use(requireAuth);

// ------------------------------------------------------------------ geocoding
// Proxied through the server on purpose: Nominatim's usage policy requires an
// identifying User-Agent, which a browser cannot set, and going direct trips
// CORS. Proxying also lets us cache and rate-limit in one place.
const NOMINATIM = "https://nominatim.openstreetmap.org";
const UA = "Carpool/1.0 (+https://github.com/carpool-platform)";

// Nominatim allows ~1 req/sec. The client debounces too, but a shared cache
// keeps repeated searches (Home, Office, ISKCON...) off the network entirely.
const cache = new Map();
const CACHE_TTL_MS = 10 * 60 * 1000;

// Nominatim asks for no more than one request a second, and means it — exceed
// it and the service starts returning 403 for everyone behind this IP. Every
// outbound call queues through here, so retries and concurrent users cannot
// collectively break the limit no matter how fast people type.
const MIN_GAP_MS = 1100;
let nextSlot = Promise.resolve();

function throttled(fn) {
  const run = nextSlot.then(fn);
  // The next caller waits for this one to finish *and* for the gap after it.
  nextSlot = run.then(
    () => new Promise((r) => setTimeout(r, MIN_GAP_MS)),
    () => new Promise((r) => setTimeout(r, MIN_GAP_MS))
  );
  return run;
}

async function searchOnce(q, near) {
  // A viewbox biases Nominatim toward the area someone actually travels in.
  // Deliberately not `bounded=1`: that would hard-restrict the search and make
  // it impossible to look up anywhere outside the box, which would break an
  // intercity trip. This asks for local results, it does not demand them.
  const box = near
    ? `&viewbox=${near.lng - 0.7},${near.lat + 0.7},${near.lng + 0.7},${near.lat - 0.7}`
    : "";

  const url =
    `${NOMINATIM}/search?format=json&limit=10&addressdetails=1` +
    `&countrycodes=in${box}&q=${encodeURIComponent(q)}`;

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 6000);
  try {
    const r = await fetch(url, { headers: { "User-Agent": UA }, signal: ctrl.signal });
    if (!r.ok) throw new Error(`Nominatim ${r.status}`);
    return (await r.json()).map((p) => ({
      label: shortLabel(p.display_name),
      fullLabel: p.display_name,
      lat: Number(p.lat),
      lng: Number(p.lon),
    }));
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Searches for a place, relaxing the query until something matches.
 *
 * Nominatim requires every word to match, which is fine for "Bopal" and
 * useless for how people actually name places: "Thaltej cross road" and
 * "Prahlad Nagar garden" both returned nothing at all, because "cross road"
 * and "garden" are not part of the name in OpenStreetMap. Someone typing a
 * perfectly ordinary landmark got an empty box and no explanation.
 *
 * So the full phrase is tried first — it gives the most precise hit when it
 * works — and on an empty result the trailing word is dropped and it is tried
 * again. "Thaltej cross road" becomes "Thaltej cross", then "Thaltej", which
 * does match. The query that actually produced the results is returned so the
 * interface can say what it searched for instead of quietly showing something
 * the person did not ask for.
 */
// Anything within this of where someone usually travels is plausibly the place
// they meant. Generous enough to cover a whole metro region and the towns
// around it, tight enough to catch a match in another state.
const NEAR_KM = 120;

async function geocode(q, near) {
  let words = q.split(/\s+/).filter(Boolean);
  let fallback = null;

  // At most three attempts: the original plus two relaxations. Each costs a
  // second of throttle, and beyond that the query is too vague to be useful.
  for (let attempt = 0; attempt < 3 && words.length > 0; attempt++) {
    const term = words.join(" ");
    const found = rankByProximity(await throttled(() => searchOnce(term, near)), near);

    if (found.length > 0) {
      const nearest = near ? haversineKm(near.lat, near.lng, found[0].lat, found[0].lng) : 0;

      // A hit near home is the answer; stop looking.
      if (nearest <= NEAR_KM) {
        return { results: found.slice(0, 6), matchedQuery: term };
      }

      // Everything found is far away. That is usually a fuzzy match on the
      // wrong place — "Bopal Circle" matches Bhopal, 500 km off, and burying
      // the user's actual neighbourhood — so keep it only as a fallback and
      // try a looser query first. Genuine intercity searches still work:
      // relaxing finds nothing closer, and this set is returned in the end.
      fallback ??= { results: found.slice(0, 6), matchedQuery: term };
    }

    words = words.slice(0, -1);
  }

  return fallback ?? { results: [], matchedQuery: null };
}

/**
 * Puts the nearest match first.
 *
 * Nominatim ranks by its own notion of importance, which is why searching
 * "Prahlad Nagar" from an Ahmedabad office offered Prahlad Nagar in Meerut,
 * and "Bopal Circle" offered a metro station in Bhopal. For a commute both are
 * absurd: the place someone means is nearly always the one closest to where
 * they already travel. Without a reference point the original order stands.
 */
function rankByProximity(results, near) {
  if (!near) return results;
  return [...results].sort(
    (a, b) =>
      haversineKm(near.lat, near.lng, a.lat, a.lng) -
      haversineKm(near.lat, near.lng, b.lat, b.lng)
  );
}

/**
 * Where this person's travel is centred, from their saved places.
 *
 * Uses the user's own data rather than a hard-coded city, so the bias is
 * right for an organisation in Pune or Chennai without anyone configuring it.
 * Someone with no saved places simply gets unbiased results.
 */
async function travelCentre(userId) {
  const places = await prisma.savedPlace.findMany({
    where: { userId },
    select: { lat: true, lng: true },
  });
  if (places.length === 0) return null;

  return {
    lat: places.reduce((s, p) => s + p.lat, 0) / places.length,
    lng: places.reduce((s, p) => s + p.lng, 0) / places.length,
  };
}

router.get(
  "/geocode",
  ah(async (req, res) => {
    const q = String(req.query.q ?? "").trim();
    if (q.length < 3) return res.json({ results: [] });

    const near = await travelCentre(req.user.id);

    // The cache key includes the bias, because two people in different cities
    // searching the same word should not be served each other's ordering.
    const key = `${q.toLowerCase()}|${near ? `${near.lat.toFixed(1)},${near.lng.toFixed(1)}` : "-"}`;
    const hit = cache.get(key);
    if (hit && Date.now() - hit.at < CACHE_TTL_MS) {
      return res.json({ results: hit.results, matchedQuery: hit.matchedQuery });
    }

    try {
      const { results, matchedQuery } = await geocode(q, near);
      cache.set(key, { at: Date.now(), results, matchedQuery });
      res.json({ results, matchedQuery });
    } catch (err) {
      // Search failing must not break the page — the user can still pick a
      // saved place, which is why Saved Places is seeded up front.
      console.warn("[geocode] failed:", err.message);
      res.json({ results: [], degraded: true });
    }
  })
);

// -------------------------------------------------------------- saved places
router.get(
  "/",
  ah(async (req, res) => {
    const places = await prisma.savedPlace.findMany({
      where: { userId: req.user.id },
      orderBy: { id: "asc" },
    });
    res.json({ places });
  })
);

router.post(
  "/",
  ah(async (req, res) => {
    const parsed = z
      .object({
        label: V.text(40, "Label"),
        address: V.text(200, "Address"),
        lat: V.latitude,
        lng: V.longitude,
      })
      .safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });

    const place = await prisma.savedPlace.create({
      data: { ...parsed.data, userId: req.user.id },
    });
    res.status(201).json({ place });
  })
);

router.delete(
  "/:id",
  ah(async (req, res) => {
    const owned = await prisma.savedPlace.findFirst({
      where: { id: req.params.id, userId: req.user.id },
    });
    if (!owned) return res.status(404).json({ error: "Place not found" });

    await prisma.savedPlace.delete({ where: { id: owned.id } });
    res.json({ ok: true });
  })
);

// "Infocity, Gandhinagar, Gujarat, 382007, India" -> "Infocity, Gandhinagar"
function shortLabel(displayName) {
  return displayName.split(",").slice(0, 2).join(",").trim();
}

export default router;
