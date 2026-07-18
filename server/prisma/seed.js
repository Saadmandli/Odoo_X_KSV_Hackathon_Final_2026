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
    avatarColor: extra.avatarColor ?? "#286b57",
    wallet: { create: { balance: extra.balance ?? 500 } },
  });

  const shrey = await prisma.user.create({
    data: employee("Shrey Naik", "shrey@northbridge.in", {
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
      employeeCode: "NB002",
      phone: "+919825011002",
      avatarColor: "#2563eb",
      balance: 1450,
    }),
  });

  const saad = await prisma.user.create({
    data: employee("Saad Mandli", "saad@northbridge.in", {
      department: "Product",
      employeeCode: "NB003",
      phone: "+919825011003",
      avatarColor: "#7c3aed",
      balance: 1800,
    }),
  });

  const ishita = await prisma.user.create({
    data: employee("Ishita Rao", "ishita@northbridge.in", {
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
      department: "Sales",
      employeeCode: "NB005",
      phone: "+919825011005",
      avatarColor: "#ea580c",
      balance: 240,
    }),
  });

  const meera = await prisma.user.create({
    data: employee("Meera Joshi", "meera@northbridge.in", {
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
  const upcoming = [
    { driver: prayag, vehicle: vehicles.swift,  from: PLACES.bopal,        to: PLACES.giftCity, when: at(1, 9, 0),  seats: 4, fare: 110, recurring: [1, 2, 3, 4, 5] },
    { driver: saad,   vehicle: vehicles.i20,    from: PLACES.prahladNagar, to: PLACES.giftCity, when: at(1, 9, 30), seats: 3, fare: 95 },
    { driver: meera,  vehicle: vehicles.ertiga, from: PLACES.adalaj,       to: PLACES.giftCity, when: at(1, 8, 45), seats: 5, fare: 80 },
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

  await prisma.notification.create({
    data: {
      userId: prayag.id,
      title: "Your ride is filling up",
      body: "Devansh, Ishita and Saad have booked seats for tomorrow morning.",
    },
  });

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

  for (let week = 24; week >= 1; week--) {
    // Two trips a week early on, rising to three: participation grows over time.
    const tripsThisWeek = week > 12 ? 1 : 2;

    for (let n = 0; n < tripsThisWeek; n++) {
      const [driver, vehicle] = drivers[(week + n) % drivers.length];
      const [from, to] = routes[(week + n) % routes.length];
      const km = estimateKm(from, to);
      const fare = 80 + ((week + n) % 4) * 15;
      const departedAt = at(-week * 7 - n, n === 0 ? 9 : 18, 15);

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
        },
      });

      // Two riders per trip, never the driver.
      const chosen = riders.filter((r) => r.id !== driver.id).slice((week + n) % 2, ((week + n) % 2) + 2);

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
        if (week === 1 && n === 1 && rider.id === saad.id && !unpaid) {
          unpaid = booking;
          continue;
        }

        await prisma.payment.create({
          data: {
            bookingId: booking.id,
            amount: fare,
            method: ["WALLET", "UPI", "CASH", "CARD"][(week + n) % 4],
            status: "COMPLETED",
            paidAt: new Date(departedAt.getTime() + 90 * 60_000),
          },
        });

        // Mostly fours and fives with the occasional three, so averages land
        // around 4.3 rather than a suspiciously perfect 5.0.
        const stars = [5, 4, 5, 5, 4, 3, 5, 4][(week + n + rider.name.length) % 8];
        await prisma.rating.create({
          data: {
            rideId: ride.id,
            raterId: rider.id,
            driverId: driver.id,
            stars,
            comment: stars >= 5 ? RATING_NOTES[(week + n) % RATING_NOTES.length] : undefined,
          },
        });
      }

      completed++;
    }
  }

  console.log(`
Seed complete — ${org.name}

  Shrey Naik       shrey@northbridge.in     / admin123       Honda City GJ01MN2266   (also administrator)
  Prayag Panchani  prayag@northbridge.in    / password123    Maruti Swift GJ18AB4471
  Saad Mandli      saad@northbridge.in      / password123    Hyundai i20 GJ01CD9032
  Ishita Rao       ishita@northbridge.in    / password123    Tata Nexon GJ27EF1188
  Meera Joshi      meera@northbridge.in     / password123    Maruti Ertiga GJ05PQ7741
  Devansh Mehta    devansh@northbridge.in   / password123    no vehicle

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
