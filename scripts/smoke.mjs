// End-to-end smoke test: login -> search -> book -> trip lifecycle -> track -> pay -> reports
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
  const json = await res.json().catch(() => ({}));
  return { status: res.status, json };
}

const login = async (email, password) => {
  const r = await call("/auth/login", { method: "POST", body: { email, password } });
  if (!r.json.token) throw new Error(`login failed for ${email}: ${JSON.stringify(r.json)}`);
  return r.json.token;
};

const BOPAL = { label: "Bopal Circle, Ahmedabad", lat: 23.0355, lng: 72.4700 };
const GIFT_CITY = { label: "GIFT City, Gandhinagar", lat: 23.1610, lng: 72.6840 };

const health = await call("/health");
ok("health endpoint", health.json.ok === true);

const rajToken = await login("prayag@northbridge.in", "password123");
const priyaToken = await login("saad@northbridge.in", "password123");
const adminToken = await login("shrey@northbridge.in", "admin123");
ok("logins (driver, passenger, admin)", !!rajToken && !!priyaToken && !!adminToken);

const badLogin = await call("/auth/login", {
  method: "POST",
  body: { email: "prayag@northbridge.in", password: "wrong" },
});
ok("wrong password rejected", badLogin.status === 401);

const outsider = await call("/auth/signup", {
  method: "POST",
  body: { name: "Outsider", email: "hacker@gmail.com", password: "password123" },
});
ok("unregistered domain blocked", outsider.status === 403, outsider.json.error ?? "");

// --- driver publishes a ride
const vehicles = await call("/vehicles", { token: rajToken });
ok("driver has vehicles", vehicles.json.vehicles?.length > 0);
const vehicleId = vehicles.json.vehicles[0].id;

const published = await call("/rides", {
  method: "POST",
  token: rajToken,
  body: {
    vehicleId,
    origin: BOPAL,
    dest: GIFT_CITY,
    departureAt: new Date(Date.now() + 2 * 3600_000).toISOString(),
    seats: 3,
    farePerSeat: 120,
  },
});
ok("publish ride", published.status === 201, `route via ${published.json.routeSource}`);
const rideId = published.json.ride?.id;
ok("route distance computed", published.json.ride?.distanceKm > 0, `${published.json.ride?.distanceKm} km`);

// --- passenger searches and books
const search = await call(
  `/rides/search?originLat=${BOPAL.lat}&originLng=${BOPAL.lng}&destLat=${GIFT_CITY.lat}&destLng=${GIFT_CITY.lng}&seats=1`,
  { token: priyaToken }
);
ok("search finds rides", search.json.count > 0, `${search.json.count} matches`);
ok("search ranks by detour", search.json.rides?.[0]?.match?.detourKm !== undefined);

const booking = await call("/bookings", {
  method: "POST",
  token: priyaToken,
  body: { rideId, seats: 1, pickup: BOPAL, drop: GIFT_CITY },
});
ok("book a seat", booking.status === 201);
const bookingId = booking.json.booking?.id;

const dupe = await call("/bookings", {
  method: "POST",
  token: priyaToken,
  body: { rideId, seats: 1, pickup: BOPAL, drop: GIFT_CITY },
});
ok("double-booking blocked", dupe.status === 409, dupe.json.error ?? "");

const selfBook = await call("/bookings", {
  method: "POST",
  token: rajToken,
  body: { rideId, seats: 1, pickup: BOPAL, drop: GIFT_CITY },
});
ok("driver cannot book own ride", selfBook.status === 400);

// --- pay before completion should be refused
const earlyPay = await call("/payments/pay", {
  method: "POST",
  token: priyaToken,
  body: { bookingId, method: "WALLET" },
});
ok("payment blocked before trip completes", earlyPay.status === 409);

// --- tracking only while active
const earlyPing = await call(`/rides/${rideId}/ping`, {
  method: "POST",
  token: rajToken,
  body: { lat: 23.05, lng: 72.55 },
});
ok("tracking blocked before trip starts", earlyPing.status === 409);

// --- lifecycle: PUBLISHED -> STARTED -> IN_PROGRESS -> COMPLETED
const started = await call(`/rides/${rideId}/advance`, { method: "POST", token: rajToken });
ok("trip started", started.json.ride?.status === "STARTED");

const ping = await call(`/rides/${rideId}/ping`, {
  method: "POST",
  token: rajToken,
  body: { lat: 23.1, lng: 72.58, speedKmph: 42 },
});
ok("driver ping accepted", ping.status === 201);

const track = await call(`/rides/${rideId}/track`, { token: priyaToken });
ok("passenger sees live position", !!track.json.position, `ETA ${track.json.etaMinutes} min`);

const ishita = await login("ishita@northbridge.in", "password123");
const nosy = await call(`/rides/${rideId}/track`, { token: ishita });
ok("non-participant cannot track", nosy.status === 403);

await call(`/rides/${rideId}/advance`, { method: "POST", token: rajToken });
const done = await call(`/rides/${rideId}/advance`, { method: "POST", token: rajToken });
ok("trip completed", done.json.ride?.status === "COMPLETED");

// --- chat
await call(`/rides/${rideId}/messages`, {
  method: "POST",
  token: priyaToken,
  body: { body: "On my way to the pickup point" },
});
const msgs = await call(`/rides/${rideId}/messages`, { token: rajToken });
ok("chat round-trips", msgs.json.messages?.length === 1);

// --- wallet payment
const walletBefore = await call("/payments/wallet", { token: priyaToken });
const pay = await call("/payments/pay", {
  method: "POST",
  token: priyaToken,
  body: { bookingId, method: "WALLET" },
});
ok("wallet payment succeeds", pay.json.payment?.status === "COMPLETED");

const walletAfter = await call("/payments/wallet", { token: priyaToken });
ok(
  "passenger wallet debited",
  walletAfter.json.balance === walletBefore.json.balance - 120,
  `${walletBefore.json.balance} -> ${walletAfter.json.balance}`
);

const driverWallet = await call("/payments/wallet", { token: rajToken });
ok("driver wallet credited", driverWallet.json.balance > 750, `= ${driverWallet.json.balance}`);

const doublePay = await call("/payments/pay", {
  method: "POST",
  token: priyaToken,
  body: { bookingId, method: "WALLET" },
});
ok("double payment blocked", doublePay.status === 409);

// --- reports
const reports = await call("/reports", { token: rajToken });
ok("reports: trips", reports.json.summary?.totalTrips > 0, `${reports.json.summary?.totalTrips} trips`);
ok("reports: fuel cost", reports.json.summary?.fuelCost > 0, `Rs ${reports.json.summary?.fuelCost}`);
ok("reports: cost per km", reports.json.summary?.costPerKm > 0, `Rs ${reports.json.summary?.costPerKm}/km`);
ok("reports: vehicle breakdown", reports.json.vehicleCosts?.length > 0);
ok("reports: efficiency trend", reports.json.fuelEfficiencyTrend?.length > 0);

// --- admin
const stats = await call("/admin/stats", { token: adminToken });
ok("admin stats", stats.json.totalEmployees > 0, JSON.stringify(stats.json));

const forbidden = await call("/admin/stats", { token: priyaToken });
ok("employee blocked from admin", forbidden.status === 403);

const employees = await call("/admin/employees", { token: adminToken });
ok("admin lists employees", employees.json.employees?.length >= 5);

const selfRevoke = await call(`/admin/employees/${employees.json.employees.find(e => e.role === "ADMIN").id}/access`, {
  method: "POST",
  token: adminToken,
  body: { approve: false },
});
ok("admin cannot revoke self", selfRevoke.status === 400);

// --- history
const history = await call("/bookings/history", { token: priyaToken });
ok("ride history populated", history.json.asPassenger?.length > 0);

console.log(`\n${failures === 0 ? "ALL CHECKS PASSED" : failures + " CHECK(S) FAILED"}`);
process.exit(failures === 0 ? 0 : 1);
