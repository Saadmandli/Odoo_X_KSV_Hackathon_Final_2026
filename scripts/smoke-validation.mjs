// Input validation, tested by trying to get bad data past every endpoint.
//
// Each case is something a real user mistypes or a careless client sends. The
// rule throughout: rubbish is rejected with a 4xx and a message a person can
// act on, never accepted and never a 500.
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
const meera = await login("meera@northbridge.in", "password123");
const shrey = await login("shrey@northbridge.in", "admin123");

const vehicleId = (await call("/vehicles", { token: prayag })).json.vehicles[0].id;
const soon = () => new Date(Date.now() + 4 * 3600_000).toISOString();
const BOPAL = { label: "Bopal", lat: 23.0353, lng: 72.4699 };
const GIFT = { label: "GIFT City", lat: 23.1615, lng: 72.6841 };

/** A rejection must be a 4xx with a message — never a 500, never a silent pass. */
const rejects = (label, res) =>
  ok(
    label,
    res.status >= 400 && res.status < 500 && Boolean(res.json.error),
    `${res.status} ${res.json.error ?? "(no message)"}`
  );

console.log("\n--- phone numbers ---");
for (const [what, value] of [
  ["letters", "abcdefghij"],
  ["a sentence", "call me maybe"],
  ["too short", "12345"],
  ["too long", "1234567890123456789"],
  ["an injection attempt", "'; DROP TABLE users; --"],
  ["only symbols", "!!!!!!!!!!"],
]) {
  rejects(
    `phone rejects ${what}`,
    await call("/auth/me", { method: "PUT", token: prayag, body: { phone: value } })
  );
}
{
  const res = await call("/auth/me", {
    method: "PUT",
    token: prayag,
    body: { phone: "98250 11002" },
  });
  ok(
    "a real number is accepted and normalised",
    res.status === 200 && res.json.user.phone === "+919825011002",
    res.json.user?.phone
  );

  const withCode = await call("/auth/me", {
    method: "PUT",
    token: prayag,
    body: { phone: "+91 (98250) 11002" },
  });
  ok(
    "punctuation and spacing are tolerated",
    withCode.json.user?.phone === "+919825011002",
    withCode.json.user?.phone
  );
}

console.log("\n--- emergency contact ---");
rejects(
  "emergency contact name rejects digits",
  await call("/auth/me", { method: "PUT", token: meera, body: { emergencyContactName: "Ritu 123" } })
);
rejects(
  "emergency contact phone rejects letters",
  await call("/auth/me", {
    method: "PUT",
    token: meera,
    body: { emergencyContactPhone: "not a phone" },
  })
);

console.log("\n--- signup ---");
for (const [what, patch] of [
  ["an email with no domain dot", { email: "someone@localhost" }],
  ["an email with no @", { email: "someone.northbridge.in" }],
  ["an email with spaces", { email: "some one@northbridge.in" }],
  ["a name of digits", { name: "12345" }],
  ["a name of symbols", { name: "!!!!" }],
  ["a one-character name", { name: "A" }],
  ["a short password", { password: "123" }],
]) {
  const res = await call("/auth/signup", {
    method: "POST",
    body: {
      name: "Valid Name",
      email: `probe${Date.now()}@northbridge.in`,
      password: "password123",
      ...patch,
    },
  });
  rejects(`signup rejects ${what}`, res);
}

console.log("\n--- coordinates ---");
for (const [what, origin] of [
  ["latitude above 90", { ...BOPAL, lat: 999 }],
  ["latitude below -90", { ...BOPAL, lat: -200 }],
  ["longitude above 180", { ...BOPAL, lng: 9999 }],
  ["an empty label", { ...BOPAL, label: "   " }],
]) {
  rejects(
    `publishing rejects ${what}`,
    await call("/rides", {
      method: "POST",
      token: prayag,
      body: { vehicleId, origin, dest: GIFT, departureAt: soon(), seats: 2, farePerSeat: 90 },
    })
  );
}

console.log("\n--- fares and seats ---");
for (const [what, patch] of [
  ["a negative fare", { farePerSeat: -50 }],
  ["an absurd fare", { farePerSeat: 99999 }],
  ["a fractional seat count", { seats: 1.5 }],
  ["zero seats", { seats: 0 }],
  ["more seats than any car", { seats: 99 }],
  ["a fare with too many decimals", { farePerSeat: 10.999 }],
  ["a non-numeric fare", { farePerSeat: "ninety" }],
  ["an unparseable departure", { departureAt: "next tuesday" }],
  ["a departure in year 9999", { departureAt: "9999-01-01T09:00:00.000Z" }],
]) {
  rejects(
    `publishing rejects ${what}`,
    await call("/rides", {
      method: "POST",
      token: prayag,
      body: {
        vehicleId,
        origin: BOPAL,
        dest: GIFT,
        departureAt: soon(),
        seats: 2,
        farePerSeat: 90,
        ...patch,
      },
    })
  );
}

console.log("\n--- vehicles ---");
for (const [what, patch] of [
  ["a registration of symbols", { registrationNumber: "!!!!!!" }],
  ["a blank model", { model: "   " }],
  ["an unknown fuel type", { fuelType: "Plutonium" }],
  ["impossible mileage", { mileageKmpl: 500 }],
  ["zero mileage", { mileageKmpl: 0 }],
  ["fractional seats", { seatingCapacity: 2.5 }],
]) {
  rejects(
    `adding a vehicle rejects ${what}`,
    await call("/vehicles", {
      method: "POST",
      token: prayag,
      body: {
        model: "Test Car",
        registrationNumber: `GJ01TS${Math.floor(Math.random() * 9000) + 1000}`,
        seatingCapacity: 4,
        ...patch,
      },
    })
  );
}
{
  const reg = `gj 01 zz ${Math.floor(Math.random() * 9000) + 1000}`;
  const res = await call("/vehicles", {
    method: "POST",
    token: prayag,
    body: { model: "Normalise Test", registrationNumber: reg, seatingCapacity: 4 },
  });
  ok(
    "a registration is uppercased and stripped",
    res.status === 201 && /^GJ01ZZ\d{4}$/.test(res.json.vehicle.registrationNumber),
    res.json.vehicle?.registrationNumber
  );
  if (res.json.vehicle) await call(`/vehicles/${res.json.vehicle.id}`, { method: "DELETE", token: prayag });
}

console.log("\n--- ratings and messages ---");
rejects(
  "a rating above 5 is refused",
  await call("/ratings", { method: "POST", token: meera, body: { rideId: "x", stars: 9 } })
);
rejects(
  "a fractional rating is refused",
  await call("/ratings", { method: "POST", token: meera, body: { rideId: "x", stars: 4.5 } })
);
rejects(
  "an empty chat message is refused",
  await call("/chat", { method: "POST", token: meera, body: { body: "     " } })
);

console.log("\n--- saved places ---");
rejects(
  "a place with a blank label is refused",
  await call("/places", {
    method: "POST",
    token: meera,
    body: { label: "  ", address: "Somewhere", lat: 23, lng: 72 },
  })
);
rejects(
  "a place off the globe is refused",
  await call("/places", {
    method: "POST",
    token: meera,
    body: { label: "Home", address: "Somewhere", lat: 500, lng: 72 },
  })
);

console.log("\n--- org settings ---");
for (const [what, patch] of [
  ["a negative fuel price", { fuelPricePerLitre: -10 }],
  ["an absurd fuel price", { fuelPricePerLitre: 99999 }],
  ["a non-email admin contact", { adminContact: "ring the office" }],
  ["a blank company name", { name: "   " }],
]) {
  rejects(
    `org settings reject ${what}`,
    await call("/admin/settings", { method: "PUT", token: shrey, body: patch })
  );
}

console.log("\n--- wallet ---");
for (const [what, body] of [
  ["a negative top-up", { amount: -500, method: "CARD" }],
  ["a zero top-up", { amount: 0, method: "CARD" }],
  ["a top-up over the cap", { amount: 999999, method: "CARD" }],
  ["an unknown method", { amount: 500, method: "BARTER" }],
]) {
  rejects(
    `wallet rejects ${what}`,
    await call("/payments/wallet/recharge/order", { method: "POST", token: meera, body })
  );
}

console.log("\n--- malformed requests ---");
{
  const empty = await call("/rides", { method: "POST", token: prayag, body: {} });
  rejects("an empty publish body is refused", empty);

  const res = await fetch(`${API}/rides`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${prayag}` },
    body: "{not json",
  });
  ok("malformed JSON does not crash the server", res.status >= 400 && res.status < 500, res.status);

  const health = await call("/health");
  ok("the server is still healthy afterwards", health.json.ok === true);
}

// Leave the demo profile as the seed wrote it.
await call("/auth/me", { method: "PUT", token: prayag, body: { phone: "+919825011002" } });

console.log(
  failures.length ? `\n${failures.length} FAILED:\n  ${failures.join("\n  ")}` : "\nALL CHECKS PASSED"
);
process.exit(failures.length ? 1 : 0);
