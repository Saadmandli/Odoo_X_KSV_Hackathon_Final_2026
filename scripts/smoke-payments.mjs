// Verifies every screen's backing API: payment methods, wallet, vehicles,
// history, reports and admin.
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
const admin = await login("shrey@northbridge.in", "admin123");

const BOPAL = { label: "Bopal Circle, Ahmedabad", lat: 23.0355, lng: 72.47 };
const GIFT = { label: "GIFT City, Gandhinagar", lat: 23.161, lng: 72.684 };

// --- payment config
const cfg = await call("/payments/config", { token: saad });
ok("payment config exposed", cfg.status === 200,
   cfg.json.razorpayEnabled ? "Razorpay live keys set" : "sandbox mode (no keys)");

// --- wallet
const w0 = await call("/payments/wallet", { token: saad });
ok("wallet loads", w0.status === 200, `balance ${w0.json.balance}`);

const order = await call("/payments/wallet/recharge/order", {
  method: "POST", token: saad, body: { amount: 500, method: "UPI" },
});
ok("recharge order created", order.status === 200, order.json.sandbox ? "sandbox" : order.json.orderId);

// With live keys the confirm step demands a verifiable signature, so an
// unsigned call must be refused. Without keys there is nothing to verify and
// the balance is credited directly. Both are correct; assert whichever applies.
const topUp = await call("/payments/wallet/recharge/confirm", {
  method: "POST", token: saad, body: { amount: 500, method: "UPI" },
});

if (cfg.json.razorpayEnabled) {
  ok("unsigned top-up refused", topUp.status === 400, topUp.json.error ?? "");
  const stillSame = (await call("/payments/wallet", { token: saad })).json.balance;
  ok("refused top-up credited nothing", stillSame === w0.json.balance,
     `${w0.json.balance} -> ${stillSame}`);
} else {
  ok("wallet credited in sandbox", topUp.json.balance === w0.json.balance + 500,
     `${w0.json.balance} -> ${topUp.json.balance}`);
}

const badAmount = await call("/payments/wallet/recharge/order", {
  method: "POST", token: saad, body: { amount: -5, method: "UPI" },
});
ok("negative top-up rejected", badAmount.status === 400);

// --- full ride so we have something to pay for
const vehicleId = (await call("/vehicles", { token: prayag })).json.vehicles[0].id;
const ride = (await call("/rides", {
  method: "POST", token: prayag,
  body: { vehicleId, origin: BOPAL, dest: GIFT,
    departureAt: new Date(Date.now() + 3600_000).toISOString(), seats: 3, farePerSeat: 100 },
})).json.ride;

const booking = (await call("/bookings", {
  method: "POST", token: saad,
  body: { rideId: ride.id, seats: 1, pickup: BOPAL, drop: GIFT },
})).json.booking;

const early = await call("/payments/order", { method: "POST", token: saad, body: { bookingId: booking.id } });
ok("cannot pay before trip completes", early.status === 409);

for (let i = 0; i < 3; i++) await call(`/rides/${ride.id}/advance`, { method: "POST", token: prayag });

// --- each payment method
const payOrder = await call("/payments/order", { method: "POST", token: saad, body: { bookingId: booking.id } });
ok("payment order created after completion", payOrder.status === 200, `₹${payOrder.json.amount}`);

const before = (await call("/payments/wallet", { token: saad })).json.balance;
const driverBefore = (await call("/payments/wallet", { token: prayag })).json.balance;

const paid = await call("/payments/pay", {
  method: "POST", token: saad, body: { bookingId: booking.id, method: "WALLET" },
});
ok("wallet payment succeeds", paid.json.payment?.status === "COMPLETED");

const after = (await call("/payments/wallet", { token: saad })).json.balance;
const driverAfter = (await call("/payments/wallet", { token: prayag })).json.balance;
ok("rider debited", after === before - 100, `${before} -> ${after}`);
ok("driver credited", driverAfter === driverBefore + 100, `${driverBefore} -> ${driverAfter}`);

const twice = await call("/payments/pay", {
  method: "POST", token: saad, body: { bookingId: booking.id, method: "CASH" },
});
ok("cannot pay twice", twice.status === 409);

// --- insufficient balance path
// The fare has to beat the rider's wallet without being nonsense: fares are
// capped at ₹5,000, and the 99999 this used to publish is precisely the kind
// of value that cap exists to stop.
const ride2 = (await call("/rides", {
  method: "POST", token: prayag,
  body: { vehicleId, origin: BOPAL, dest: GIFT,
    departureAt: new Date(Date.now() + 7200_000).toISOString(), seats: 3, farePerSeat: 4800 },
})).json.ride;
const booking2 = (await call("/bookings", {
  method: "POST", token: saad,
  body: { rideId: ride2.id, seats: 1, pickup: BOPAL, drop: GIFT },
})).json.booking;
for (let i = 0; i < 3; i++) await call(`/rides/${ride2.id}/advance`, { method: "POST", token: prayag });

const broke = await call("/payments/pay", {
  method: "POST", token: saad, body: { bookingId: booking2.id, method: "WALLET" },
});
ok("insufficient balance blocked", broke.status === 402, broke.json.error ?? "");
ok("shortfall reported to the UI", typeof broke.json.shortfall === "number", `₹${broke.json.shortfall}`);

// --- vehicles screen
const vlist = await call("/vehicles", { token: prayag });
ok("vehicles list loads", vlist.json.vehicles?.length > 0);

// Unique per run so a crashed earlier run cannot leave a duplicate behind.
const plate = `GJ05ZZ${String(Date.now()).slice(-4)}`;
const added = await call("/vehicles", {
  method: "POST", token: saad,
  body: { model: "Tata Punch", registrationNumber: plate.toLowerCase().replace(/(.{2})/g, "$1 "), seatingCapacity: 4, fuelType: "Petrol", mileageKmpl: 20 },
});
ok("vehicle added", added.status === 201, added.json.error ?? "");
ok("registration normalised", added.json.vehicle?.registrationNumber === plate,
   added.json.vehicle?.registrationNumber);

const dupe = await call("/vehicles", {
  method: "POST", token: saad,
  body: { model: "Tata Punch", registrationNumber: plate, seatingCapacity: 4 },
});
ok("duplicate vehicle rejected", dupe.status === 409);
if (added.json.vehicle?.id) {
  await call(`/vehicles/${added.json.vehicle.id}`, { method: "DELETE", token: saad });
}

// --- history
const hist = await call("/bookings/history", { token: saad });
ok("history loads", hist.status === 200, `${hist.json.asPassenger?.length} as rider`);

// --- reports
const rep = await call("/reports", { token: prayag });
ok("personal report loads", rep.json.summary?.totalTrips > 0, `${rep.json.summary.totalTrips} trips`);
ok("report has efficiency trend", Array.isArray(rep.json.fuelEfficiencyTrend));
ok("report has vehicle costs", Array.isArray(rep.json.vehicleCosts));
ok("report has monthly summary", Array.isArray(rep.json.monthlySummary));

// --- admin
const stats = await call("/admin/stats", { token: admin });
ok("admin stats load", stats.json.totalEmployees > 0);

const emps = await call("/admin/employees", { token: admin });
ok("admin employees load", emps.json.employees?.length > 0);

const target = emps.json.employees.find((e) => e.role !== "ADMIN");
const revoked = await call(`/admin/employees/${target.id}/access`, {
  method: "POST", token: admin, body: { approve: false },
});
ok("admin can revoke access", revoked.json.employee?.isApproved === false);

const lockedOut = await call("/vehicles", { token: await login(target.email, "password123") });
ok("revoked employee is locked out", lockedOut.status === 403, lockedOut.json.error ?? "");

await call(`/admin/employees/${target.id}/access`, { method: "POST", token: admin, body: { approve: true } });

const adminVehicles = await call("/admin/vehicles", { token: admin });
ok("admin vehicles load", adminVehicles.json.vehicles?.length > 0);

const settings = await call("/admin/settings", { token: admin });
ok("admin settings load", settings.json.org?.fuelPricePerLitre > 0);

const updated = await call("/admin/settings", {
  method: "PUT", token: admin, body: { fuelPricePerLitre: 102.75 },
});
ok("admin settings save", updated.json.org?.fuelPricePerLitre === 102.75);
await call("/admin/settings", { method: "PUT", token: admin, body: { fuelPricePerLitre: 98.5 } });

// --- saved places
const places = await call("/places", { token: saad });
ok("saved places load", places.json.places?.length > 0);

console.log(`\n${failures === 0 ? "ALL CHECKS PASSED" : failures + " CHECK(S) FAILED"}`);
process.exit(failures === 0 ? 0 : 1);
