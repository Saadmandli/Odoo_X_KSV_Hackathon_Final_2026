// Safety features, tested adversarially: women-only matching and SOS.
//
// Every check here is something a user could actually attempt, including
// posting straight at the API with an id that was never rendered on screen —
// which is the case the UI cannot protect against and the server must.
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

const ishita = await login("ishita@northbridge.in", "password123"); // FEMALE
const meera = await login("meera@northbridge.in", "password123"); //   FEMALE
const devansh = await login("devansh@northbridge.in", "password123"); // MALE
const prayag = await login("prayag@northbridge.in", "password123"); //  MALE, has a vehicle
const shrey = await login("shrey@northbridge.in", "admin123"); //       ADMIN

const VASTRAPUR = { lat: 23.0395, lng: 72.5312 };
const GIFT = { lat: 23.1615, lng: 72.6841 };
const searchQuery = `originLat=${VASTRAPUR.lat}&originLng=${VASTRAPUR.lng}&destLat=${GIFT.lat}&destLng=${GIFT.lng}&seats=1&windowHours=48`;

console.log("\n--- gender is on the profile ---");
{
  const me = await call("/auth/me", { token: ishita });
  ok("gender is returned", me.json.user.gender === "FEMALE", me.json.user.gender);
  ok(
    "emergency contact is returned",
    Boolean(me.json.user.emergencyContactPhone),
    me.json.user.emergencyContactPhone
  );

  const saved = await call("/auth/me", {
    method: "PUT",
    token: devansh,
    body: { emergencyContactName: "Test Contact", emergencyContactPhone: "+919000000000" },
  });
  ok("can save an emergency contact", saved.status === 200);

  const cleared = await call("/auth/me", {
    method: "PUT",
    token: devansh,
    body: { emergencyContactPhone: "" },
  });
  ok(
    "clearing a contact stores null, not an empty string",
    cleared.json.user?.emergencyContactPhone === null,
    JSON.stringify(cleared.json.user?.emergencyContactPhone)
  );

  const promote = await call("/auth/me", { method: "PUT", token: devansh, body: { role: "ADMIN" } });
  const after = await call("/auth/me", { token: devansh });
  ok("profile update cannot promote to admin", after.json.user.role === "EMPLOYEE", promote.status);
}

console.log("\n--- who may publish a women-only ride ---");
let womenOnlyRideId = null;
{
  const seeded = await call("/rides/mine", { token: ishita });
  const anyWomenOnly = seeded.json.rides.find((r) => r.womenOnly && r.status === "PUBLISHED");
  ok("seed contains a women-only ride", Boolean(anyWomenOnly), anyWomenOnly?.originLabel);
  womenOnlyRideId = anyWomenOnly?.id ?? null;

  // A man cannot mark his own ride women-only, even posting directly.
  const vehicles = await call("/vehicles", { token: prayag });
  const attempt = await call("/rides", {
    method: "POST",
    token: prayag,
    body: {
      vehicleId: vehicles.json.vehicles[0].id,
      origin: { label: "Bopal", ...VASTRAPUR },
      dest: { label: "GIFT City", ...GIFT },
      departureAt: new Date(Date.now() + 3 * 3600_000).toISOString(),
      seats: 2,
      farePerSeat: 90,
      womenOnly: true,
    },
  });
  ok("a man cannot publish a women-only ride", attempt.status === 403, attempt.json.error);
}

console.log("\n--- who can see a women-only ride ---");
{
  const forWoman = await call(`/rides/search?${searchQuery}`, { token: meera });
  const forMan = await call(`/rides/search?${searchQuery}`, { token: devansh });

  const womanSees = forWoman.json.rides.some((r) => r.womenOnly);
  const manSees = forMan.json.rides.some((r) => r.womenOnly);

  ok("a woman sees women-only rides", womanSees, `${forWoman.json.count} results`);
  ok("a man does not see them at all", !manSees, `${forMan.json.count} results`);

  const filtered = await call(`/rides/search?${searchQuery}&womenOnly=true`, { token: meera });
  ok(
    "the women-only filter returns only those rides",
    filtered.json.rides.length > 0 && filtered.json.rides.every((r) => r.womenOnly),
    `${filtered.json.count} results`
  );
}

console.log("\n--- who can book one ---");
{
  ok("a women-only ride exists to test against", Boolean(womenOnlyRideId), womenOnlyRideId);

  // The real test: a man posting the ride id directly, having never seen it.
  const blocked = await call("/bookings", {
    method: "POST",
    token: devansh,
    body: {
      rideId: womenOnlyRideId,
      seats: 1,
      pickup: { label: "Vastrapur", ...VASTRAPUR },
      drop: { label: "GIFT City", ...GIFT },
    },
  });
  ok("a man cannot book it even knowing the id", blocked.status === 403, blocked.json.error);

  const allowed = await call("/bookings", {
    method: "POST",
    token: meera,
    body: {
      rideId: womenOnlyRideId,
      seats: 1,
      pickup: { label: "Vastrapur", ...VASTRAPUR },
      drop: { label: "GIFT City", ...GIFT },
    },
  });
  ok("a woman can book it", allowed.status === 201, allowed.json.error ?? "booked");

  // Seats must still have been claimed, not silently skipped.
  const { ride } = (await call(`/rides/${womenOnlyRideId}`, { token: meera })).json;
  ok("the seat was actually taken", ride.seatsLeft === 2, `seatsLeft ${ride.seatsLeft}`);
}

console.log("\n--- SOS ---");
let alertId = null;
{
  const before = await call("/notifications", { token: shrey });
  const beforeCount = before.json.notifications.length;

  const raised = await call("/sos", {
    method: "POST",
    token: meera,
    body: { lat: 23.15, lng: 72.68, note: "Smoke test alert" },
  });
  ok("an alert can be raised", raised.status === 201, `notified ${raised.json.notified}`);
  alertId = raised.json.alert?.id;

  const after = await call("/notifications", { token: shrey });
  ok(
    "the admin is notified",
    after.json.notifications.length > beforeCount &&
      after.json.notifications[0].title.includes("SOS"),
    after.json.notifications[0]?.title
  );

  const noLocation = await call("/sos", { method: "POST", token: meera, body: {} });
  ok(
    "an alert still goes out with no location",
    noLocation.status === 201,
    noLocation.json.error ?? "raised"
  );

  const listed = await call("/sos", { token: shrey });
  ok("the admin can list alerts", listed.status === 200, `${listed.json.activeCount} active`);
  ok(
    "the emergency contact reaches the admin",
    listed.json.alerts.some((a) => a.user?.emergencyContactPhone),
    "present"
  );

  const asEmployee = await call("/sos", { token: devansh });
  ok("an employee cannot list alerts", asEmployee.status === 403, asEmployee.json.error);

  const resolveAsEmployee = await call(`/sos/${alertId}/resolve`, {
    method: "POST",
    token: devansh,
  });
  ok("an employee cannot resolve one", resolveAsEmployee.status === 403);

  const resolved = await call(`/sos/${alertId}/resolve`, { method: "POST", token: shrey });
  ok("the admin can resolve it", resolved.json.alert?.status === "RESOLVED");

  const twice = await call(`/sos/${alertId}/resolve`, { method: "POST", token: shrey });
  ok("resolving twice is refused", twice.status === 409, twice.json.error);
}

console.log("\n--- safety report ---");
{
  const denied = await call("/reports/safety", { token: devansh });
  ok("an employee cannot read it", denied.status === 403);

  const report = await call("/reports/safety", { token: shrey });
  ok("the admin can read it", report.status === 200);
  ok(
    "women-only take-up is counted",
    report.json.summary.womenOnlyRides > 0,
    `${report.json.summary.womenOnlyRides} rides, ${report.json.summary.womenOnlyShare}%`
  );
  ok(
    "female participation is counted",
    report.json.summary.activeWomen > 0,
    `${report.json.summary.activeWomen}/${report.json.summary.activeTravellers} travellers`
  );
  ok(
    "SOS response time is reported",
    report.json.sos.resolved > 0 && report.json.sos.averageResponseMinutes !== null,
    `${report.json.sos.averageResponseMinutes} min average over ${report.json.sos.resolved}`
  );
  ok(
    "the rating trend has months in it",
    report.json.ratings.trend.length > 1,
    `average ${report.json.ratings.average} over ${report.json.ratings.count}`
  );
}

console.log(
  failures.length ? `\n${failures.length} FAILED:\n  ${failures.join("\n  ")}` : "\nALL CHECKS PASSED"
);
process.exit(failures.length ? 1 : 0);
