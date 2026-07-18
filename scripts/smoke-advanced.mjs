// Smoke test for route optimisation, recurring rides, and org analytics.
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
const ishita = await login("ishita@northbridge.in", "password123");
const devansh = await login("devansh@northbridge.in", "password123");
const admin = await login("shrey@northbridge.in", "admin123");

const BOPAL = { label: "Bopal Circle, Ahmedabad", lat: 23.0355, lng: 72.4700 };
const GIFT_CITY = { label: "GIFT City, Gandhinagar", lat: 23.1610, lng: 72.6840 };

// Three pickups deliberately given in the WORST possible booking order:
// far -> near -> middle. A good plan must reorder them.
const FAR = { label: "Adalaj", lat: 23.1667, lng: 72.5806 };
const NEAR = { label: "Vastrapur", lat: 23.0369, lng: 72.5309 };
const MID = { label: "Gota", lat: 23.1013, lng: 72.5470 };

const vehicles = await call("/vehicles", { token: prayag });
const vehicleId = vehicles.json.vehicles[0].id;

const ride = (
  await call("/rides", {
    method: "POST",
    token: prayag,
    body: {
      vehicleId,
      origin: BOPAL,
      dest: GIFT_CITY,
      departureAt: new Date(Date.now() + 5 * 3600_000).toISOString(),
      seats: 4,
      farePerSeat: 90,
      isRecurring: true,
      recurrenceDays: [1, 3, 5],
    },
  })
).json.ride;

for (const [token, pickup] of [
  [saad, FAR],
  [ishita, NEAR],
  [devansh, MID],
]) {
  const r = await call("/bookings", {
    method: "POST",
    token,
    body: { rideId: ride.id, seats: 1, pickup, drop: GIFT_CITY },
  });
  if (r.status !== 201) console.log("   (booking failed:", r.json.error, ")");
}

// --- route optimisation
const plan = await call(`/rides/${ride.id}/plan`, { token: prayag });
ok("plan returns every stop", plan.json.stops?.length === 3, `${plan.json.stops?.length} stops`);
ok(
  "plan is no worse than booking order",
  plan.json.optimisedKm <= plan.json.bookingOrderKm,
  `${plan.json.optimisedKm} km vs ${plan.json.bookingOrderKm} km`
);
ok("plan actually saves distance", plan.json.savedKm > 0, `saves ${plan.json.savedKm} km`);
ok(
  "nearest pickup is collected first",
  plan.json.stops?.[0]?.label === "Vastrapur",
  plan.json.stops?.map((s) => s.label).join(" -> ")
);
ok("stops are sequenced", plan.json.stops?.every((s, i) => s.sequence === i + 1));

const notDriver = await call(`/rides/${ride.id}/plan`, { token: saad });
ok("only the driver sees the pickup plan", notDriver.status === 404);

// --- recurring rides
const repeat = await call(`/rides/${ride.id}/repeat`, {
  method: "POST",
  token: prayag,
  body: { weeks: 2 },
});
ok("recurring occurrences created", repeat.json.created > 0, `${repeat.json.created} rides`);

const repeatAgain = await call(`/rides/${ride.id}/repeat`, {
  method: "POST",
  token: prayag,
  body: { weeks: 2 },
});
ok(
  "repeat is idempotent",
  repeatAgain.json.created === 0 && repeatAgain.json.skipped > 0,
  `created ${repeatAgain.json.created}, skipped ${repeatAgain.json.skipped}`
);

const notRecurring = await call("/rides/search?originLat=23.0273&originLng=72.5075&destLat=23.19&destLng=72.62", {
  token: saad,
});
ok("occurrences are bookable rides", notRecurring.json.count > 0, `${notRecurring.json.count} found`);

// --- org analytics
const denied = await call("/reports/org", { token: saad });
ok("employee blocked from org analytics", denied.status === 403);

const org = await call("/reports/org", { token: admin });
ok("org analytics returns", org.status === 200);
ok("counts completed rides", org.json.summary?.completedRides > 0, `${org.json.summary?.completedRides}`);
ok("computes CO2 saved", org.json.summary?.co2SavedKg > 0, `${org.json.summary?.co2SavedKg} kg`);
ok("computes fuel saved", org.json.summary?.litresSaved > 0, `${org.json.summary?.litresSaved} L`);
ok(
  "translates CO2 into something human",
  typeof org.json.summary?.treeEquivalent === "number",
  `${org.json.summary?.treeEquivalent} trees`
);
ok("ranks top routes", org.json.topRoutes?.length > 0, org.json.topRoutes?.[0]?.route ?? "");
ok("builds a leaderboard", org.json.leaderboard?.length > 0, `${org.json.leaderboard?.length} people`);
ok("breaks down by department", org.json.byDepartment?.length > 0,
   org.json.byDepartment?.map((d) => d.department).join(", "));

console.log(`\n${failures === 0 ? "ALL CHECKS PASSED" : failures + " CHECK(S) FAILED"}`);
process.exit(failures === 0 ? 0 : 1);
