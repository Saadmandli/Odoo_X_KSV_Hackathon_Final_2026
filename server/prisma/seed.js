import dotenv from "dotenv";
dotenv.config({ override: true });

import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

// Real Ahmedabad / Gandhinagar coordinates along the daily commute corridor.
const PLACES = {
  bopal:        { label: "Bopal Circle, Ahmedabad",     lat: 23.0355, lng: 72.4700 },
  prahladNagar: { label: "Prahlad Nagar, Ahmedabad",    lat: 23.0125, lng: 72.5070 },
  thaltej:      { label: "Thaltej, Ahmedabad",          lat: 23.0530, lng: 72.5100 },
  vastrapur:    { label: "Vastrapur, Ahmedabad",        lat: 23.0369, lng: 72.5309 },
  gota:         { label: "Gota, Ahmedabad",             lat: 23.1013, lng: 72.5470 },
  adalaj:       { label: "Adalaj, Gandhinagar",         lat: 23.1667, lng: 72.5806 },
  giftCity:     { label: "GIFT City, Gandhinagar",      lat: 23.1610, lng: 72.6840 },
  kudasan:      { label: "Kudasan, Gandhinagar",        lat: 23.1780, lng: 72.6350 },
  sector21:     { label: "Sector 21, Gandhinagar",      lat: 23.2000, lng: 72.6300 },
};

const hash = (p) => bcrypt.hashSync(p, 10);

const RATING_NOTES = [
  "On time and easy to find at the pickup point.",
  "Comfortable drive, good conversation.",
  "Waited for me when I was running late.",
  "Knows the shortcuts, got us in early.",
];

/** A date N days from now, pinned to a specific local hour and minute. */
function at(daysFromNow, hour, minute = 0) {
  const d = new Date();
  d.setDate(d.getDate() + daysFromNow);
  d.setHours(hour, minute, 0, 0);
  return d;
}

/** Straight line with a city detour factor. The seed must not need network. */
function estimateKm(a, b) {
  const R = 6371;
  const toRad = (deg) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.sqrt(s)) * 1.3 * 100) / 100;
}

const minutesFor = (km) => Math.round((km / 28) * 60);

async function main() {
  console.log("Seeding…");

  // Deleting the organisation cascades to every user, ride, booking, payment
  // and wallet beneath it, so a re-run always starts from a clean slate.
  await prisma.organization.deleteMany({ where: { domain: "northbridge.in" } });

  const org = await prisma.organization.create({
    data: {
      name: "Northbridge Technologies",
      domain: "northbridge.in",
      registeredAddress: "Northbridge House, SG Highway, Ahmedabad, Gujarat 380015",
      industry: "Software",
      adminContact: "shrey@northbridge.in",
      fuelPricePerLitre: 98.5,
      costPerKm: 4.2,
      travelCostPerKm: 2.5,
    },
  });

  const employee = (name, email, extra = {}) => ({
    orgId: org.id,
    name,
    email,
    passwordHash: hash(extra.password ?? "password123"),
    phone: extra.phone,
    department: extra.department ?? "Engineering",
    officeLocation: extra.officeLocation ?? "GIFT City",
    manager: extra.manager ?? "S. Naik",
    employeeCode: extra.employeeCode,
    role: extra.role ?? "EMPLOYEE",
    gender: extra.gender ?? "UNDISCLOSED",
    emergencyContactName: extra.emergencyContactName,
    emergencyContactPhone: extra.emergencyContactPhone,
    avatarColor: extra.avatarColor ?? "#286b57",
    wallet: { create: { balance: extra.balance ?? 500 } },
  });

  const shrey = await prisma.user.create({
    data: employee("Shrey Naik", "shrey@northbridge.in", {
      gender: "MALE",
      password: "admin123",
      role: "ADMIN",
      department: "Operations",
      employeeCode: "NB001",
      phone: "+919825011001",
      avatarColor: "#1f6b51",
      balance: 2000,
    }),
  });

  const prayag = await prisma.user.create({
    data: employee("Prayag Panchani", "prayag@northbridge.in", {
      gender: "MALE",
      employeeCode: "NB002",
      phone: "+919825011002",
      avatarColor: "#2563eb",
      balance: 1450,
    }),
  });

  const saad = await prisma.user.create({
    data: employee("Saad Mandli", "saad@northbridge.in", {
      gender: "MALE",
      department: "Product",
      employeeCode: "NB003",
      phone: "+919825011003",
      avatarColor: "#7c3aed",
      balance: 1800,
    }),
  });

  const ishita = await prisma.user.create({
    data: employee("Ishita Rao", "ishita@northbridge.in", {
      gender: "FEMALE",
      emergencyContactName: "Anil Rao (father)",
      emergencyContactPhone: "+919825044001",
      department: "Finance",
      officeLocation: "Ahmedabad",
      employeeCode: "NB004",
      phone: "+919825011004",
      avatarColor: "#db2777",
      balance: 960,
    }),
  });

  const devansh = await prisma.user.create({
    data: employee("Devansh Mehta", "devansh@northbridge.in", {
      gender: "MALE",
      department: "Sales",
      employeeCode: "NB005",
      phone: "+919825011005",
      avatarColor: "#ea580c",
      balance: 240,
    }),
  });

  // Priya exists so the women-only feature can be shown from both sides in one
  // sitting: Ishita drives the car, Priya is the woman who books a seat in it.
  // Deliberately left with no vehicle, no history and no booking — she is the
  // account to sign into on stage and book the women-only ride live, and a
  // rider with nothing behind her is also the clearest way to show a colleague
  // joining the scheme for the first time.
  const priya = await prisma.user.create({
    data: employee("Priya Shah", "priya@northbridge.in", {
      gender: "FEMALE",
      emergencyContactName: "Nisha Shah (mother)",
      emergencyContactPhone: "+919825044003",
      department: "Human Resources",
      employeeCode: "NB007",
      phone: "+919825011007",
      avatarColor: "#c026d3",
      balance: 800,
    }),
  });

  const meera = await prisma.user.create({
    data: employee("Meera Joshi", "meera@northbridge.in", {
      gender: "FEMALE",
      emergencyContactName: "Ritu Joshi (sister)",
      emergencyContactPhone: "+919825044002",
      department: "Design",
      employeeCode: "NB006",
      phone: "+919825011006",
      avatarColor: "#0891b2",
      balance: 675,
    }),
  });

  // ------------------------------------------------------------- vehicles
  const vehicles = {};
  for (const [key, data] of Object.entries({
    swift:  { user: prayag, model: "Maruti Swift",  registrationNumber: "GJ18AB4471", seatingCapacity: 4, fuelType: "Petrol", mileageKmpl: 21.2, color: "White" },
    i20:    { user: saad,   model: "Hyundai i20",   registrationNumber: "GJ01CD9032", seatingCapacity: 4, fuelType: "Petrol", mileageKmpl: 19.4, color: "Grey" },
    nexon:  { user: ishita, model: "Tata Nexon",    registrationNumber: "GJ27EF1188", seatingCapacity: 4, fuelType: "Diesel", mileageKmpl: 17.6, color: "Blue" },
    city:   { user: shrey,  model: "Honda City",    registrationNumber: "GJ01MN2266", seatingCapacity: 4, fuelType: "Petrol", mileageKmpl: 18.4, color: "Silver" },
    ertiga: { user: meera,  model: "Maruti Ertiga", registrationNumber: "GJ05PQ7741", seatingCapacity: 6, fuelType: "CNG",    mileageKmpl: 26.1, color: "Beige" },
  })) {
    const { user, ...rest } = data;
    vehicles[key] = await prisma.vehicle.create({ data: { userId: user.id, ...rest } });
  }

  // ---------------------------------------------------------- saved places
  const homes = {
    [shrey.id]: PLACES.thaltej,
    [prayag.id]: PLACES.bopal,
    [saad.id]: PLACES.prahladNagar,
    [ishita.id]: PLACES.vastrapur,
    [devansh.id]: PLACES.gota,
    [meera.id]: PLACES.adalaj,
    // Thaltej sits on the route Ishita's women-only car already takes, so
    // Priya's saved Home is somewhere that ride can realistically collect her.
    [priya.id]: PLACES.thaltej,
  };

  for (const [userId, home] of Object.entries(homes)) {
    await prisma.savedPlace.createMany({
      data: [
        { userId, label: "Home", address: home.label, lat: home.lat, lng: home.lng },
        { userId, label: "Office", address: PLACES.giftCity.label, lat: PLACES.giftCity.lat, lng: PLACES.giftCity.lng },
      ],
    });
  }

  // -------------------------------------------------- upcoming, bookable
  // Real commute times: morning runs into the office, evening runs home.
  // Three rides, each demonstrating something different, so the search results
  // are short enough to talk through:
  //   1. Prayag  — already pooled, shows pickup-order optimisation and repeats weekly
  //   2. Saad    — plenty of seats, the straightforward one to book on stage
  //   3. Meera   — a different route and a cheaper CNG fare, so results are not identical
  //   4. Ishita  — women-only, so the safety filter has something to find and
  //                the same search run as Prayag returns three results, not four
  //
  // Four and no more. Every extra ride is another row to account for while
  // presenting, and a screen of near-identical trips makes the one that
  // matters harder to point at, not easier to believe.
  const upcoming = [
    { driver: prayag, vehicle: vehicles.swift,  from: PLACES.bopal,        to: PLACES.giftCity, when: at(1, 9, 0),  seats: 4, fare: 110, recurring: [1, 2, 3, 4, 5] },
    { driver: saad,   vehicle: vehicles.i20,    from: PLACES.prahladNagar, to: PLACES.giftCity, when: at(1, 9, 30), seats: 3, fare: 95 },
    { driver: meera,  vehicle: vehicles.ertiga, from: PLACES.adalaj,       to: PLACES.giftCity, when: at(1, 8, 45), seats: 5, fare: 80 },
    { driver: ishita, vehicle: vehicles.nexon,  from: PLACES.vastrapur,    to: PLACES.giftCity, when: at(1, 9, 15), seats: 3, fare: 105, womenOnly: true },
  ];

  const created = [];
  for (const r of upcoming) {
    const km = estimateKm(r.from, r.to);
    created.push(
      await prisma.ride.create({
        data: {
          orgId: org.id,
          driverId: r.driver.id,
          vehicleId: r.vehicle.id,
          originLabel: r.from.label, originLat: r.from.lat, originLng: r.from.lng,
          destLabel: r.to.label, destLat: r.to.lat, destLng: r.to.lng,
          departureAt: r.when,
          totalSeats: r.seats,
          seatsLeft: r.seats,
          farePerSeat: r.fare,
          distanceKm: km,
          durationMin: minutesFor(km),
          isRecurring: Boolean(r.recurring),
          recurrenceDays: r.recurring ?? [],
          womenOnly: Boolean(r.womenOnly),
        },
      })
    );
  }

  // Prayag's Bopal run already has three riders. They booked in the order they
  // happened to open the app, which is close to the worst possible driving
  // order: furthest first, then nearest, then the one in between. That is what
  // makes the pickup-order optimisation visibly worth having.
  const pooled = created[0];
  for (const [rider, pickup] of [
    [devansh, PLACES.adalaj],
    [ishita, PLACES.vastrapur],
    [saad, PLACES.gota],
  ]) {
    await prisma.booking.create({
      data: {
        rideId: pooled.id,
        passengerId: rider.id,
        seats: 1,
        fareAmount: Number(pooled.farePerSeat),
        pickupLabel: pickup.label, pickupLat: pickup.lat, pickupLng: pickup.lng,
        dropLabel: PLACES.giftCity.label, dropLat: PLACES.giftCity.lat, dropLng: PLACES.giftCity.lng,
      },
    });
  }
  await prisma.ride.update({
    where: { id: pooled.id },
    data: { seatsLeft: pooled.totalSeats - 3 },
  });

  // Meera takes a seat in Ishita's women-only car. One booking, not eight: it
  // is the single row needed to show a women-only ride actually carrying
  // someone, and it still leaves two seats free to book live on stage.
  const womenOnlyRide = created[3];
  await prisma.booking.create({
    data: {
      rideId: womenOnlyRide.id,
      passengerId: meera.id,
      seats: 1,
      fareAmount: Number(womenOnlyRide.farePerSeat),
      pickupLabel: PLACES.vastrapur.label,
      pickupLat: PLACES.vastrapur.lat,
      pickupLng: PLACES.vastrapur.lng,
      dropLabel: PLACES.giftCity.label,
      dropLat: PLACES.giftCity.lat,
      dropLng: PLACES.giftCity.lng,
    },
  });
  await prisma.ride.update({
    where: { id: womenOnlyRide.id },
    data: { seatsLeft: { decrement: 1 } },
  });

  await prisma.notification.create({
    data: {
      userId: prayag.id,
      title: "Your ride is filling up",
      body: "Devansh, Ishita and Saad have booked seats for tomorrow morning.",
    },
  });

  // ------------------------------------------------------ organisation chat
  // A short thread that shows what the channel is for: asking for a lift
  // before a ride exists to book.
  const minutesAgo = (m) => new Date(Date.now() - m * 60_000);
  const thread = [
    [devansh, "Anyone driving towards GIFT City tomorrow around 9? Adalaj side.", 180],
    [prayag, "Yes, leaving Bopal at 9. I can swing past Adalaj, it is barely a detour.", 168],
    [devansh, "That would be great, booking now. Thanks!", 165],
    [ishita, "Reminder: SG Highway had roadworks near Thaltej this morning, leave 10 minutes early.", 95],
    [meera, "Ertiga has 5 seats free on the Adalaj run if anyone needs one this week.", 40],
  ];

  for (const [sender, body, ago] of thread) {
    await prisma.orgMessage.create({
      data: { orgId: org.id, senderId: sender.id, body, createdAt: minutesAgo(ago) },
    });
  }

  // ------------------------------------------------ history for the reports
  // Spread across six months so the efficiency trend has a real line, and
  // rotated across drivers and vehicles so the cost breakdown has depth.
  const routes = [
    [PLACES.bopal, PLACES.giftCity],
    [PLACES.prahladNagar, PLACES.giftCity],
    [PLACES.thaltej, PLACES.sector21],
    [PLACES.adalaj, PLACES.giftCity],
    [PLACES.vastrapur, PLACES.kudasan],
  ];
  const drivers = [
    [prayag, vehicles.swift],
    [saad, vehicles.i20],
    [meera, vehicles.ertiga],
    [ishita, vehicles.nexon],
  ];
  const riders = [saad, ishita, devansh, meera, prayag];

  let completed = 0;
  let unpaid = null;
  // Counts trips driven by a woman, so every second one can be women-only.
  // Deriving that from the week number instead kept colliding with the
  // expressions that pick the driver and the riders.
  let femaleDriven = 0;

  // One trip a month across six months. Six completed journeys is the floor
  // for the reports to mean anything — the efficiency trend still has six
  // points, so it reads as a line rather than a dot — while leaving Ride
  // History short enough to take in at a glance. Anything more was data to
  // account for on stage rather than evidence of anything.
  const HISTORY_WEEKS = [24, 20, 16, 12, 8, 4];
  const lastWeek = HISTORY_WEEKS[HISTORY_WEEKS.length - 1];

  for (const [trip, week] of HISTORY_WEEKS.entries()) {
    const tripsThisWeek = 1;

    for (let n = 0; n < tripsThisWeek; n++) {
      // Rotated on the trip counter, not the week. The weeks are a month
      // apart and every one of them divides by four, so `week % drivers.length`
      // selected index 0 every single time — Prayag drove the entire history,
      // no woman drove at all, and the safety report had nothing to count.
      const [driver, vehicle] = drivers[(trip + n) % drivers.length];
      const [from, to] = routes[(trip + n) % routes.length];
      const km = estimateKm(from, to);
      const fare = 80 + ((trip + n) % 4) * 15;
      const departedAt = at(-week * 7 - n, n === 0 ? 9 : 18, 15);

      // Every second trip driven by a woman ran women-only, so the safety
      // report shows real take-up rather than one upcoming example.
      //
      // Counted rather than derived from the week: any modulus of `week`
      // collides with the expression that picks the driver, which is how an
      // earlier version selected a male driver every time and silently
      // produced no women-only trips at all.
      if (driver.gender === "FEMALE") femaleDriven++;
      const womenOnly = driver.gender === "FEMALE" && femaleDriven % 2 === 1;

      const ride = await prisma.ride.create({
        data: {
          orgId: org.id,
          driverId: driver.id,
          vehicleId: vehicle.id,
          originLabel: from.label, originLat: from.lat, originLng: from.lng,
          destLabel: to.label, destLat: to.lat, destLng: to.lng,
          departureAt: departedAt,
          totalSeats: 3,
          seatsLeft: 1,
          farePerSeat: fare,
          distanceKm: km,
          durationMin: minutesFor(km),
          status: "COMPLETED",
          startedAt: departedAt,
          completedAt: new Date(departedAt.getTime() + minutesFor(km) * 60_000),
          womenOnly,
        },
      });

      // Two riders per trip, never the driver. A women-only trip draws from the
      // women alone — seeding one with a man aboard would contradict the rule
      // the rest of the system enforces.
      const pool = riders.filter(
        (r) => r.id !== driver.id && (!womenOnly || r.gender === "FEMALE")
      );
      // The offset rotates so the same two people are not in every car. It is
      // derived from the trip index rather than the week, because the loop now
      // steps a fortnight at a time and `week % 2` is constant — which left
      // Devansh, the one rider with no vehicle of his own, in no history at all.
      const offset = completed % Math.max(1, pool.length - 1);
      const chosen = womenOnly ? pool : pool.slice(offset, offset + 2);

      for (const rider of chosen) {
        const booking = await prisma.booking.create({
          data: {
            rideId: ride.id,
            passengerId: rider.id,
            seats: 1,
            fareAmount: fare,
            pickupLabel: from.label, pickupLat: from.lat, pickupLng: from.lng,
            dropLabel: to.label, dropLat: to.lat, dropLng: to.lng,
            status: "COMPLETED",
          },
        });

        // Leave the single most recent fare unpaid so the payment screen has
        // something real to demonstrate.
        //
        // Keyed on the loop's own last entry rather than a hard-coded week.
        // A literal broke twice already: every time the spacing of the history
        // changed, that week stopped being reached and every fare silently
        // came out paid, quietly removing the payment screen from the demo.
        if (week === lastWeek && rider.id === saad.id && !unpaid) {
          unpaid = booking;
          continue;
        }

        await prisma.payment.create({
          data: {
            bookingId: booking.id,
            amount: fare,
            method: ["WALLET", "UPI", "CASH", "CARD"][(trip + n) % 4],
            status: "COMPLETED",
            paidAt: new Date(departedAt.getTime() + 90 * 60_000),
          },
        });

        // Mostly fours and fives with the occasional three, so averages land
        // around 4.3 rather than a suspiciously perfect 5.0.
        const stars = [5, 4, 5, 5, 4, 3, 5, 4][(trip + n + rider.name.length) % 8];
        await prisma.rating.create({
          data: {
            rideId: ride.id,
            raterId: rider.id,
            driverId: driver.id,
            stars,
            comment: stars >= 5 ? RATING_NOTES[(trip + n) % RATING_NOTES.length] : undefined,
          },
        });
      }

      completed++;
    }
  }

  // ------------------------------------------------------------------- SOS
  // Two closed incidents so the safety dashboard opens with a response-time
  // figure and a visible history, rather than an empty state that says nothing
  // about how the org handles them. Nothing is left ACTIVE: an alert that is
  // already flashing when the page loads would misrepresent the demo, and the
  // live one should be the one raised on stage.
  const sosSeed = [
    {
      user: meera,
      hoursAgo: 52,
      resolvedAfterMin: 4,
      note: "Driver took an unfamiliar turn near Adalaj. Resolved — roadworks diversion.",
    },
    {
      user: ishita,
      hoursAgo: 19,
      resolvedAfterMin: 7,
      note: "Felt unwell on the way to GIFT City and wanted someone to know.",
    },
  ];

  for (const s of sosSeed) {
    const raisedAt = new Date(Date.now() - s.hoursAgo * 3600_000);
    await prisma.sosAlert.create({
      data: {
        orgId: org.id,
        userId: s.user.id,
        lat: PLACES.giftCity.lat + 0.01,
        lng: PLACES.giftCity.lng - 0.01,
        note: s.note,
        status: "RESOLVED",
        createdAt: raisedAt,
        resolvedAt: new Date(raisedAt.getTime() + s.resolvedAfterMin * 60_000),
        resolvedBy: shrey.name,
      },
    });
  }

  console.log(`
Seed complete — ${org.name}

  Shrey Naik       shrey@northbridge.in     / admin123       Honda City GJ01MN2266   (also administrator)
  Prayag Panchani  prayag@northbridge.in    / password123    Maruti Swift GJ18AB4471
  Saad Mandli      saad@northbridge.in      / password123    Hyundai i20 GJ01CD9032
  Ishita Rao       ishita@northbridge.in    / password123    Tata Nexon GJ27EF1188    (woman — drives the women-only ride)
  Meera Joshi      meera@northbridge.in     / password123    Maruti Ertiga GJ05PQ7741 (woman)
  Priya Shah       priya@northbridge.in     / password123    no vehicle               (woman — sign in as her to book the women-only ride)
  Devansh Mehta    devansh@northbridge.in   / password123    no vehicle               (man — cannot see women-only rides)

  Any of them can publish a ride or book a seat.

  ${upcoming.length} upcoming rides   — Prayag's 09:00 Bopal run already has 3 riders,
                        so the pickup-order optimisation is visible immediately
  ${completed} completed trips  — spread over 6 months for the efficiency trend
  1 unpaid fare       — Saad has a completed trip awaiting payment
`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
