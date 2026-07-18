// Live tracking, driven end to end: publish, start, move, watch, finish.
//
// Pings are fed along the real route so the checks exercise what a passenger
// actually sees — distance falling, progress rising, ETA responding to speed —
// rather than just asserting the endpoint returns 201.
const API = "http://localhost:4000/api";

let failures = [];
const ok = (label, cond, detail = "") => {
  console.log(`${cond ? "PASS" : "FAIL"}  ${label}${detail ? `  — ${detail}` : ""}`);
  if (!cond) failures.push(label);
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
const devansh = await login("devansh@northbridge.in", "password123");

const BOPAL = { label: "Bopal Circle, Ahmedabad", lat: 23.0353, lng: 72.4699 };
const GIFT = { label: "GIFT City, Gandhinagar", lat: 23.1615, lng: 72.6841 };

// Straight-line interpolation between the two ends: enough to move the marker
// convincingly without depending on the routing service being reachable.
const along = (t) => ({
  lat: BOPAL.lat + (GIFT.lat - BOPAL.lat) * t,
  lng: BOPAL.lng + (GIFT.lng - BOPAL.lng) * t,
});

const vehicleId = (await call("/vehicles", { token: prayag })).json.vehicles[0].id;

console.log("\n--- set up a trip ---");
const ride = (
  await call("/rides", {
    method: "POST",
    token: prayag,
    body: {
      vehicleId,
      origin: BOPAL,
      dest: GIFT,
      departureAt: new Date(Date.now() + 20 * 60_000).toISOString(),
      seats: 3,
      farePerSeat: 110,
    },
  })
).json.ride;
ok("ride published", Boolean(ride?.id));

const booking = (
  await call("/bookings", {
    method: "POST",
    token: saad,
    body: { rideId: ride.id, seats: 1, pickup: BOPAL, drop: GIFT },
  })
).json.booking;
ok("passenger booked a seat", Boolean(booking?.id));

console.log("\n--- tracking is closed before the trip starts ---");
{
  const early = await call(`/rides/${ride.id}/ping`, {
    method: "POST",
    token: prayag,
    body: { lat: BOPAL.lat, lng: BOPAL.lng },
  });
  ok("pings are refused before departure", early.status === 409, early.json.error);
}

console.log("\n--- start the journey ---");
{
  const started = await call(`/rides/${ride.id}/advance`, { method: "POST", token: prayag });
  ok("driver starts the trip", started.json.ride?.status === "STARTED", started.json.ride?.status);
  ok("startedAt is stamped", Boolean(started.json.ride?.startedAt));
}

console.log("\n--- bad fixes are rejected ---");
for (const [what, body] of [
  ["a latitude off the globe", { lat: 999, lng: 72 }],
  ["a missing longitude", { lat: 23 }],
  ["an impossible speed", { lat: 23.1, lng: 72.6, speedKmph: 4000 }],
  ["a heading out of range", { lat: 23.1, lng: 72.6, heading: 900 }],
]) {
  const res = await call(`/rides/${ride.id}/ping`, { method: "POST", token: prayag, body });
  ok(`ping rejects ${what}`, res.status === 400, res.json.error);
}

console.log("\n--- only the driver may report position ---");
{
  const asRider = await call(`/rides/${ride.id}/ping`, {
    method: "POST",
    token: saad,
    body: { lat: 23.1, lng: 72.6 },
  });
  ok("a passenger cannot post a position", asRider.status === 404, asRider.status);
}

console.log("\n--- the vehicle moves ---");
let firstRemaining = null;
let lastProgress = -1;
for (const t of [0.1, 0.35, 0.6, 0.85]) {
  const at = along(t);
  const sent = await call(`/rides/${ride.id}/ping`, {
    method: "POST",
    token: prayag,
    body: { ...at, speedKmph: 34, heading: 48, accuracyM: 8 },
  });
  if (sent.status !== 201) ok(`ping at ${t} accepted`, false, sent.json.error);

  const track = (await call(`/rides/${ride.id}/track`, { token: saad })).json;
  if (firstRemaining === null) firstRemaining = track.remainingKm;

  const advancing = track.progressPercent > lastProgress;
  ok(
    `progress advances at ${Math.round(t * 100)}% of the route`,
    advancing,
    `${track.progressPercent}% · ${track.remainingKm} km left · eta ${track.etaMinutes} min`
  );
  lastProgress = track.progressPercent;
}

console.log("\n--- what the passenger sees ---");
{
  const track = (await call(`/rides/${ride.id}/track`, { token: saad })).json;
  ok("distance remaining shrank", track.remainingKm < firstRemaining, `${firstRemaining} -> ${track.remainingKm}`);
  ok("speed is reported", track.position.speedKmph === 34, track.position.speedKmph);
  ok("heading is reported", track.position.heading === 48, track.position.heading);
  ok("accuracy is reported", track.position.accuracyM === 8, track.position.accuracyM);
  ok("the fix is fresh", track.fixAgeSeconds != null && track.fixAgeSeconds < 30, `${track.fixAgeSeconds}s`);
  ok("an ETA is given", track.etaMinutes > 0, `${track.etaMinutes} min`);

  // A stopped vehicle must not produce an infinite ETA.
  await call(`/rides/${ride.id}/ping`, {
    method: "POST",
    token: prayag,
    body: { ...along(0.86), speedKmph: 0 },
  });
  const stopped = (await call(`/rides/${ride.id}/track`, { token: saad })).json;
  ok(
    "a stationary vehicle still has a sane ETA",
    Number.isFinite(stopped.etaMinutes) && stopped.etaMinutes > 0 && stopped.etaMinutes < 600,
    `${stopped.etaMinutes} min`
  );
}

console.log("\n--- who may watch ---");
{
  const outsider = await call(`/rides/${ride.id}/track`, { token: devansh });
  ok("someone not on the trip cannot watch", outsider.status === 403, outsider.json.error);
}

console.log("\n--- finish the journey ---");
{
  await call(`/rides/${ride.id}/advance`, { method: "POST", token: prayag }); // IN_PROGRESS
  const done = await call(`/rides/${ride.id}/advance`, { method: "POST", token: prayag });
  ok("driver completes the trip", done.json.ride?.status === "COMPLETED", done.json.ride?.status);
  ok("completedAt is stamped", Boolean(done.json.ride?.completedAt));

  const after = await call(`/rides/${ride.id}/ping`, {
    method: "POST",
    token: prayag,
    body: { lat: GIFT.lat, lng: GIFT.lng },
  });
  ok("location sharing stops once the trip ends", after.status === 409, after.json.error);

  const paying = await call("/bookings/my-trips", { token: saad });
  ok(
    "the finished trip waits for payment",
    paying.json.asPassenger.some((b) => b.rideId === ride.id),
    "still listed"
  );
}

console.log(
  failures.length ? `\n${failures.length} FAILED:\n  ${failures.join("\n  ")}` : "\nALL CHECKS PASSED"
);
process.exit(failures.length ? 1 : 0);
