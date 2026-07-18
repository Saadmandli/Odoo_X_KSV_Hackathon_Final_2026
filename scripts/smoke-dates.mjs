// Past-date protection: publishing, searching and booking must all refuse
// journeys that have already departed.
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

const prayag = await login("prayag@northbridge.in", "password123");
const saad = await login("saad@northbridge.in", "password123");

const BOPAL = { label: "Bopal Circle, Ahmedabad", lat: 23.0355, lng: 72.47 };
const GIFT = { label: "GIFT City, Gandhinagar", lat: 23.161, lng: 72.684 };

const vehicleId = (await call("/vehicles", { token: prayag })).json.vehicles[0].id;

const publish = (departureAt) =>
  call("/rides", {
    method: "POST",
    token: prayag,
    body: { vehicleId, origin: BOPAL, dest: GIFT, departureAt, seats: 3, farePerSeat: 100 },
  });

// ---------------------------------------------------------------- publishing
const yesterday = await publish(new Date(Date.now() - 86400_000).toISOString());
ok("yesterday rejected", yesterday.status === 400, yesterday.json.error ?? "");

const lastYear = await publish("2024-01-01T10:00:00.000Z");
ok("last year rejected", lastYear.status === 400, lastYear.json.error ?? "");

const garbage = await publish("banana");
ok("unparseable date rejected", garbage.status === 400, garbage.json.error ?? "");
ok(
  "unparseable date is not treated as a past date",
  garbage.json.error?.includes("valid"),
  garbage.json.error ?? ""
);

const justNow = await publish(new Date(Date.now() - 30_000).toISOString());
ok("30s ago still allowed (grace period)", justNow.status === 201);

const tooOld = await publish(new Date(Date.now() - 10 * 60_000).toISOString());
ok("10 min ago rejected (beyond grace)", tooOld.status === 400, tooOld.json.error ?? "");

const future = await publish(new Date(Date.now() + 4 * 3600_000).toISOString());
ok("future ride still publishes", future.status === 201);

// ------------------------------------------------------------------- search
const params = (departureAt) =>
  new URLSearchParams({
    originLat: BOPAL.lat, originLng: BOPAL.lng,
    destLat: GIFT.lat, destLng: GIFT.lng,
    seats: "1", departureAt,
  });

const pastSearch = await call(`/rides/search?${params(new Date(Date.now() - 5 * 86400_000).toISOString())}`, {
  token: saad,
});
ok("search in the past returns nothing", pastSearch.json.count === 0, `${pastSearch.json.count} found`);
ok("search in the past is not an error", pastSearch.status === 200);

const nowSearch = await call(`/rides/search?${params(new Date().toISOString())}`, { token: saad });
ok("search now returns rides", nowSearch.json.count > 0, `${nowSearch.json.count} found`);
ok(
  "no returned ride departs in the past",
  nowSearch.json.rides.every((r) => new Date(r.departureAt).getTime() >= Date.now() - 60_000),
  nowSearch.json.rides.map((r) => r.departureAt).slice(0, 2).join(", ")
);

// ------------------------------------------------------------------ booking
// Publish a ride, then move it into the past directly so we can prove the
// booking guard fires rather than relying on the publish guard.
const target = future.json.ride;
ok("test ride available to book", !!target?.id);

const booked = await call("/bookings", {
  method: "POST",
  token: saad,
  body: { rideId: target.id, seats: 1, pickup: BOPAL, drop: GIFT },
});
ok("future ride books fine", booked.status === 201, booked.json.error ?? "");

// A ride created inside the grace window is already in the past, so booking it
// must fail even though publishing it succeeded.
const stale = justNow.json.ride;
const staleBooking = await call("/bookings", {
  method: "POST",
  token: saad,
  body: { rideId: stale.id, seats: 1, pickup: BOPAL, drop: GIFT },
});
ok("departed ride cannot be booked", staleBooking.status === 409, staleBooking.json.error ?? "");

console.log(`\n${failures === 0 ? "ALL CHECKS PASSED" : failures + " CHECK(S) FAILED"}`);
process.exit(failures === 0 ? 0 : 1);
