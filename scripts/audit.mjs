// Adversarial audit. Every check here is something a user could do wrong, or
// something a malicious colleague could try. Failures are real defects.
const API = "http://localhost:4000/api";

let bugs = [];
const ok = (label, cond, detail = "") => {
  console.log(`${cond ? "ok  " : "BUG "} ${label}${detail ? "  — " + detail : ""}`);
  if (!cond) bugs.push(label);
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
const shrey = await login("shrey@northbridge.in", "admin123");

const A = { label: "Bopal Circle, Ahmedabad", lat: 23.0355, lng: 72.47 };
const B = { label: "GIFT City, Gandhinagar", lat: 23.161, lng: 72.684 };

const vehicleId = (await call("/vehicles", { token: prayag })).json.vehicles[0].id;
const mkRide = async (over = {}) =>
  (
    await call("/rides", {
      method: "POST",
      token: prayag,
      body: {
        vehicleId, origin: A, dest: B,
        departureAt: new Date(Date.now() + 8 * 3600_000).toISOString(),
        seats: 3, farePerSeat: 100, ...over,
      },
    })
  ).json.ride;

console.log("\n--- privacy: in-trip chat ---");
const chatRide = await mkRide();
await call("/bookings", { method: "POST", token: saad, body: { rideId: chatRide.id, seats: 1, pickup: A, drop: B } });
await call(`/rides/${chatRide.id}/messages`, { method: "POST", token: saad, body: { body: "See you at the gate" } });

const outsiderRead = await call(`/rides/${chatRide.id}/messages`, { token: devansh });
ok("outsider cannot read a trip's chat", outsiderRead.status === 403,
   outsiderRead.status === 200 ? `read ${outsiderRead.json.messages?.length} message(s)` : "");

const outsiderWrite = await call(`/rides/${chatRide.id}/messages`, {
  method: "POST", token: devansh, body: { body: "I should not be here" },
});
ok("outsider cannot post into a trip's chat", outsiderWrite.status === 403,
   outsiderWrite.status === 201 ? "message accepted" : "");

console.log("\n--- seats ---");
const seatRide = await mkRide({ seats: 2 });
const overbook = await call("/bookings", {
  method: "POST", token: saad, body: { rideId: seatRide.id, seats: 5, pickup: A, drop: B },
});
ok("cannot book more seats than exist", overbook.status !== 201, `status ${overbook.status}`);

const zero = await call("/bookings", {
  method: "POST", token: saad, body: { rideId: seatRide.id, seats: 0, pickup: A, drop: B },
});
ok("cannot book zero seats", zero.status === 400);

await call("/bookings", { method: "POST", token: saad, body: { rideId: seatRide.id, seats: 2, pickup: A, drop: B } });
const full = await call("/bookings", {
  method: "POST", token: ishita, body: { rideId: seatRide.id, seats: 1, pickup: A, drop: B },
});
ok("cannot book a full ride", full.status === 409, full.json.error ?? "");

console.log("\n--- cancellation restores seats ---");
const cancelRide = await mkRide({ seats: 3 });
const bk = (await call("/bookings", {
  method: "POST", token: saad, body: { rideId: cancelRide.id, seats: 2, pickup: A, drop: B },
})).json.booking;
await call(`/bookings/${bk.id}/cancel`, { method: "POST", token: saad });
const after = await call(`/rides/${cancelRide.id}`, { token: prayag });
ok("cancelling gives the seats back", after.json.ride.seatsLeft === 3, `seatsLeft ${after.json.ride.seatsLeft}`);

const reBook = await call("/bookings", {
  method: "POST", token: saad, body: { rideId: cancelRide.id, seats: 1, pickup: A, drop: B },
});
ok("can rebook after cancelling", reBook.status === 201, reBook.json.error ?? "");

const otherCancel = await call(`/bookings/${bk.id}/cancel`, { method: "POST", token: ishita });
ok("cannot cancel someone else's booking", otherCancel.status === 404);

console.log("\n--- ratings ---");
const rateRide = await mkRide();
await call("/bookings", { method: "POST", token: ishita, body: { rideId: rateRide.id, seats: 1, pickup: A, drop: B } });
const early = await call("/ratings", { method: "POST", token: ishita, body: { rideId: rateRide.id, stars: 5 } });
ok("cannot rate before the trip completes", early.status === 409, early.json.error ?? "");

for (let i = 0; i < 3; i++) await call(`/rides/${rateRide.id}/advance`, { method: "POST", token: prayag });
const sixStars = await call("/ratings", { method: "POST", token: ishita, body: { rideId: rateRide.id, stars: 6 } });
ok("rejects a rating above 5", sixStars.status === 400);
const zeroStars = await call("/ratings", { method: "POST", token: ishita, body: { rideId: rateRide.id, stars: 0 } });
ok("rejects a rating below 1", zeroStars.status === 400);

await call("/ratings", { method: "POST", token: ishita, body: { rideId: rateRide.id, stars: 4 } });
await call("/ratings", { method: "POST", token: ishita, body: { rideId: rateRide.id, stars: 2 } });
const mine = await call(`/ratings/mine/${rateRide.id}`, { token: ishita });
ok("re-rating replaces rather than duplicates", mine.json.rating?.stars === 2, `stars ${mine.json.rating?.stars}`);

console.log("\n--- payments ---");
const payRide = await mkRide();
const payBooking = (await call("/bookings", {
  method: "POST", token: saad, body: { rideId: payRide.id, seats: 1, pickup: A, drop: B },
})).json.booking;
for (let i = 0; i < 3; i++) await call(`/rides/${payRide.id}/advance`, { method: "POST", token: prayag });

const otherPays = await call("/payments/pay", {
  method: "POST", token: ishita, body: { bookingId: payBooking.id, method: "WALLET" },
});
ok("cannot pay someone else's fare", otherPays.status === 404);

const negative = await call("/payments/wallet/recharge/order", {
  method: "POST", token: saad, body: { amount: -500, method: "UPI" },
});
ok("cannot recharge a negative amount", negative.status === 400);

console.log("\n--- vehicles ---");
const badSeats = await call("/vehicles", {
  method: "POST", token: devansh,
  body: { model: "Test", registrationNumber: "GJ99XX0001", seatingCapacity: 0 },
});
ok("vehicle needs at least one seat", badSeats.status === 400);

const tooManySeats = await call("/rides", {
  method: "POST", token: prayag,
  body: { vehicleId, origin: A, dest: B, departureAt: new Date(Date.now() + 9 * 3600_000).toISOString(), seats: 8, farePerSeat: 50 },
});
ok("cannot offer more seats than the car has", tooManySeats.status === 400, tooManySeats.json.error ?? "");

console.log("\n--- admin boundaries ---");
const employeeStats = await call("/admin/stats", { token: saad });
ok("employee cannot read admin stats", employeeStats.status === 403);

const employeeSettings = await call("/admin/settings", { method: "PUT", token: saad, body: { fuelPricePerLitre: 1 } });
ok("employee cannot change org settings", employeeSettings.status === 403);

const employeeOrgReport = await call("/reports/org", { token: saad });
ok("employee cannot read org-wide analytics", employeeOrgReport.status === 403);

console.log("\n--- saved places ---");
const place = (await call("/places", {
  method: "POST", token: saad, body: { label: "Gym", address: "Somewhere", lat: 23.1, lng: 72.5 },
})).json.place;
const stealDelete = await call(`/places/${place.id}`, { method: "DELETE", token: ishita });
ok("cannot delete another person's saved place", stealDelete.status === 404);
await call(`/places/${place.id}`, { method: "DELETE", token: saad });

console.log("\n--- auth ---");
const noToken = await call("/rides/mine");
ok("unauthenticated request refused", noToken.status === 401);

const junkToken = await call("/rides/mine", { token: "not.a.real.token" });
ok("forged token refused", junkToken.status === 401);

console.log("\n--- search input ---");
const noCoords = await call("/rides/search?seats=1", { token: saad });
ok("search without coordinates is a clean 400", noCoords.status === 400);

const nanCoords = await call("/rides/search?originLat=abc&originLng=xyz&destLat=1&destLng=2", { token: saad });
ok("search with junk coordinates is a clean 400", nanCoords.status === 400);

console.log(`\n${bugs.length === 0 ? "NO DEFECTS FOUND" : bugs.length + " DEFECT(S):\n  - " + bugs.join("\n  - ")}`);
process.exit(bugs.length === 0 ? 0 : 1);
