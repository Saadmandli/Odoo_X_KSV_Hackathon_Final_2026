// The full journey, from two accounts at once: driver publishes, rider books,
// driver starts, position moves, rider watches, driver completes, rider pays,
// money lands in the driver's wallet.
const API = "http://localhost:4000/api";

let failures = 0;
const ok = (label, cond, extra = "") => {
  console.log(`${cond ? "PASS" : "FAIL"}  ${label}${extra ? "  — " + extra : ""}`);
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

const driver = await login("prayag@northbridge.in", "password123");
const rider = await login("ishita@northbridge.in", "password123");

const A = { label: "Bopal Circle, Ahmedabad", lat: 23.0355, lng: 72.47 };
const B = { label: "GIFT City, Gandhinagar", lat: 23.161, lng: 72.684 };

// ------------------------------------------------------------- 1. publish
const vehicleId = (await call("/vehicles", { token: driver })).json.vehicles[0].id;
const ride = (
  await call("/rides", {
    method: "POST",
    token: driver,
    body: {
      vehicleId, origin: A, dest: B,
      departureAt: new Date(Date.now() + 2 * 3600_000).toISOString(),
      seats: 3, farePerSeat: 120,
    },
  })
).json.ride;
ok("1. driver publishes a ride", !!ride?.id, `${ride?.distanceKm} km`);

// --------------------------------------------------------------- 2. book
const booking = (
  await call("/bookings", {
    method: "POST", token: rider,
    body: { rideId: ride.id, seats: 1, pickup: A, drop: B },
  })
).json.booking;
ok("2. rider books a seat", !!booking?.id, `₹${booking?.fareAmount}`);

const seatsNow = (await call(`/rides/${ride.id}`, { token: driver })).json.ride.seatsLeft;
ok("   seat count drops immediately", seatsNow === 2, `${seatsNow} left`);

const driverInbox = (await call("/notifications", { token: driver })).json;
ok("   driver is notified", driverInbox.notifications.some((n) => /booked/i.test(n.body)));

// ------------------------------------------------------ 3. rider's view pre-start
let riderView = (await call(`/rides/${ride.id}`, { token: rider })).json.ride;
ok("3. rider sees the trip as open", riderView.status === "PUBLISHED", riderView.status);

const earlyTrack = await call(`/rides/${ride.id}/track`, { token: rider });
ok("   no location shared before departure", !earlyTrack.json.position);

// -------------------------------------------------------------- 4. start
const started = await call(`/rides/${ride.id}/advance`, { method: "POST", token: driver });
ok("4. driver starts the trip", started.json.ride.status === "STARTED");

riderView = (await call(`/rides/${ride.id}`, { token: rider })).json.ride;
ok("   rider's view reflects the change", riderView.status === "STARTED", riderView.status);

// --------------------------------------------------- 5. position every few seconds
const leg = [
  [23.052, 72.502], [23.078, 72.541], [23.104, 72.579],
  [23.131, 72.618], [23.152, 72.658],
];
for (const [lat, lng] of leg) {
  await call(`/rides/${ride.id}/ping`, { method: "POST", token: driver, body: { lat, lng, speedKmph: 34 } });
}

const tracked = await call(`/rides/${ride.id}/track`, { token: rider });
ok("5. rider sees the vehicle moving", !!tracked.json.position,
   `at ${tracked.json.position?.lat.toFixed(3)}, ${tracked.json.position?.lng.toFixed(3)}`);
ok("   latest position wins", Math.abs(tracked.json.position.lat - 23.152) < 0.001);
ok("   ETA is computed", tracked.json.etaMinutes > 0, `${tracked.json.etaMinutes} min`);

// ETA should shrink as the car approaches the destination.
const earlyEta = tracked.json.etaMinutes;
await call(`/rides/${ride.id}/ping`, { method: "POST", token: driver, body: { lat: 23.159, lng: 72.680 } });
const lateEta = (await call(`/rides/${ride.id}/track`, { token: rider })).json.etaMinutes;
ok("   ETA falls as the car nears the drop", lateEta < earlyEta, `${earlyEta} -> ${lateEta} min`);

// ------------------------------------------------------------ 6. in progress
await call(`/rides/${ride.id}/advance`, { method: "POST", token: driver });
riderView = (await call(`/rides/${ride.id}`, { token: rider })).json.ride;
ok("6. trip moves to in progress", riderView.status === "IN_PROGRESS", riderView.status);

// --------------------------------------------------------------- 7. complete
const done = await call(`/rides/${ride.id}/advance`, { method: "POST", token: driver });
ok("7. driver completes the trip", done.json.ride.status === "COMPLETED");

const afterEnd = await call(`/rides/${ride.id}/track`, { token: rider });
ok("   location sharing stops on completion", !["STARTED", "IN_PROGRESS"].includes(afterEnd.json.status));

const trips = (await call("/bookings/my-trips", { token: rider })).json;
const owed = trips.asPassenger.find((b) => b.id === booking.id);
ok("   rider now owes the fare", owed.ride.status === "COMPLETED" && !owed.payment,
   `₹${owed.fareAmount} outstanding`);

// ---------------------------------------------------------------- 8. pay
const riderBefore = (await call("/payments/wallet", { token: rider })).json.balance;
const driverBefore = (await call("/payments/wallet", { token: driver })).json.balance;

const paid = await call("/payments/pay", {
  method: "POST", token: rider, body: { bookingId: booking.id, method: "WALLET" },
});
ok("8. rider pays from wallet", paid.json.payment?.status === "COMPLETED");

const riderAfter = (await call("/payments/wallet", { token: rider })).json.balance;
const driverAfter = (await call("/payments/wallet", { token: driver })).json.balance;

ok("   rider is debited", riderAfter === riderBefore - 120, `${riderBefore} -> ${riderAfter}`);
ok("   driver is credited the same", driverAfter === driverBefore + 120, `${driverBefore} -> ${driverAfter}`);

const txns = (await call("/payments/wallet", { token: driver })).json.transactions;
ok("   driver sees the credit in their statement",
   txns.some((t) => t.type === "CREDIT" && Number(t.amount) === 120));

// ---------------------------------------------------------------- 9. after
const history = (await call("/bookings/history", { token: rider })).json;
ok("9. trip lands in ride history", history.asPassenger.some((b) => b.id === booking.id));

const rated = await call("/ratings", { method: "POST", token: rider, body: { rideId: ride.id, stars: 5 } });
ok("   rider can rate the driver", rated.status === 201);

console.log(`\n${failures === 0 ? "FULL JOURNEY VERIFIED" : failures + " STEP(S) FAILED"}`);
process.exit(failures === 0 ? 0 : 1);
