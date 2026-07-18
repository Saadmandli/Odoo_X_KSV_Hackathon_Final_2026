import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { requireAuth, ah } from "../middleware/auth.js";

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

router.get(
  "/geocode",
  ah(async (req, res) => {
    const q = String(req.query.q ?? "").trim();
    if (q.length < 3) return res.json({ results: [] });

    const key = q.toLowerCase();
    const hit = cache.get(key);
    if (hit && Date.now() - hit.at < CACHE_TTL_MS) return res.json({ results: hit.results });

    try {
      const url =
        `${NOMINATIM}/search?format=json&limit=6&addressdetails=1` +
        `&countrycodes=in&q=${encodeURIComponent(q)}`;

      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 6000);
      const r = await fetch(url, { headers: { "User-Agent": UA }, signal: ctrl.signal });
      clearTimeout(timer);
      if (!r.ok) throw new Error(`Nominatim ${r.status}`);

      const results = (await r.json()).map((p) => ({
        label: shortLabel(p.display_name),
        fullLabel: p.display_name,
        lat: Number(p.lat),
        lng: Number(p.lon),
      }));

      cache.set(key, { at: Date.now(), results });
      res.json({ results });
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
        label: z.string().min(1),
        address: z.string().min(1),
        lat: z.number(),
        lng: z.number(),
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
