// Smoke test for the differentiator features: suggested fare + shared live link.
const API = "http://localhost:4000/api";

let failures = 0;
const ok = (label, cond, extra = "") => {
  console.log(`${cond ? "PASS" : "FAIL"}  ${label}${extra ? "  " + extra : ""}`);
  if (!cond) failures++;
};

async function call(path, { method = "GET", token, body } = {}) {
  const res = await fetch(API + path, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, json: await res.json().catch(() => ({})) };
}

const login = async (email, password) =>
  (await call("/auth/login", { method: "POST", body: { email, password } })).json.token;

const BOPAL = { label: "Bopal Circle, Ahmedabad", lat: 23.0355, lng: 72.4700 };
const GIFT_CITY = { label: "GIFT City, Gandhinagar", lat: 23.1610, lng: 72.6840 };

const prayag = await login("prayag@northbridge.in", "password123");
const saad = await login("saad@northbridge.in", "password123");

// --- suggested fare from org fuel config + vehicle mileage
const vehicles = await call("/vehicles", { token: prayag });
const vehicleId = vehicles.json.vehicles[0].id;

const plain = await call("/rides/route-preview", {
  method: "POST",
  token: prayag,
  body: { origin: BOPAL, dest: GIFT_CITY },
});
ok("route preview without vehicle omits fare", plain.json.suggestedFare === null);

const withFare = await call("/rides/route-preview", {
  method: "POST",
  token: prayag,
  body: { origin: BOPAL, dest: GIFT_CITY, vehicleId, seats: 3 },
});
const sf = withFare.json.suggestedFare;
ok("suggested fare computed", sf?.amount > 0, `₹${sf?.amount}`);
ok("fare shows its basis", typeof sf?.basis === "string", sf?.basis ?? "");
ok("fuel cost derived from mileage", sf?.litres > 0 && sf?.fuelCost > 0,
   `${sf?.litres} L = ₹${sf?.fuelCost}`);

// --- publish + book so we have a live trip
const ride = (
  await call("/rides", {
    method: "POST",
    token: prayag,
    body: {
      vehicleId,
      origin: BOPAL,
      dest: GIFT_CITY,
      departureAt: new Date(Date.now() + 3600_000).toISOString(),
      seats: 3,
      farePerSeat: sf.amount,
    },
  })
).json.ride;

await call("/bookings", {
  method: "POST",
  token: saad,
  body: { rideId: ride.id, seats: 1, pickup: BOPAL, drop: GIFT_CITY },
});

// --- share link
const outsider = await login("ishita@northbridge.in", "password123");
const denied = await call(`/rides/${ride.id}/share`, { method: "POST", token: outsider });
ok("non-participant cannot mint a share link", denied.status === 403);

const shared = await call(`/rides/${ride.id}/share`, { method: "POST", token: saad });
ok("passenger can mint a share link", shared.status === 200 && !!shared.json.shareToken);
const token = shared.json.shareToken;

const again = await call(`/rides/${ride.id}/share`, { method: "POST", token: saad });
ok("share token is stable across calls", again.json.shareToken === token);

// --- public endpoint, no auth header at all
const beforeStart = await call(`/public/track/${token}`);
ok("public link works without auth", beforeStart.status === 200);
ok("inactive before trip starts", beforeStart.json.active === false);

await call(`/rides/${ride.id}/advance`, { method: "POST", token: prayag }); // STARTED
await call(`/rides/${ride.id}/ping`, {
  method: "POST",
  token: prayag,
  body: { lat: 23.12, lng: 72.58 },
});

const live = await call(`/public/track/${token}`);
ok("public link shows live position", !!live.json.position, `ETA ${live.json.etaMinutes} min`);
ok("public link exposes only first name", live.json.driverName === "Prayag", live.json.driverName);

// Encoded polylines legitimately contain "@", so exclude the geometry before
// scanning for personal data rather than substring-matching the whole blob.
const { routeGeometry, ...scannable } = live.json;
const blob = JSON.stringify(scannable);
ok("public link leaks no email", !/[\w.]+@[\w.]+/.test(blob));
ok("public link leaks no phone", !/\+?\d{10,}/.test(blob));
ok("public link leaks no org name", !blob.toLowerCase().includes("northbridge"));
ok(
  "public link exposes only expected fields",
  Object.keys(live.json).every((k) =>
    ["active", "status", "from", "to", "driverName", "vehicle", "position", "etaMinutes", "origin", "destination", "routeGeometry"].includes(k)
  ),
  Object.keys(live.json).join(",")
);

const bad = await call("/public/track/not-a-real-token");
ok("invalid token rejected", bad.status === 404);

// --- link dies with the trip
await call(`/rides/${ride.id}/advance`, { method: "POST", token: prayag }); // IN_PROGRESS
await call(`/rides/${ride.id}/advance`, { method: "POST", token: prayag }); // COMPLETED

const after = await call(`/public/track/${token}`);
ok("link stops sharing location once trip ends", after.json.active === false && !after.json.position);

console.log(`\n${failures === 0 ? "ALL CHECKS PASSED" : failures + " CHECK(S) FAILED"}`);
process.exit(failures === 0 ? 0 : 1);
