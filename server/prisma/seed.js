import dotenv from "dotenv";
dotenv.config({ override: true });

import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

// Real Ahmedabad / Gandhinagar coordinates along the daily commute corridor.
const PLACES = {
  bopal:        { label: "Bopal Circle, Ahmedabad",     lat: 23.0355, lng: 72.4700 },
  giftCity:     { label: "GIFT City, Gandhinagar",      lat: 23.1610, lng: 72.6840 },
  prahladNagar: { label: "Prahlad Nagar, Ahmedabad",    lat: 23.0125, lng: 72.5070 },
  sector21:     { label: "Sector 21, Gandhinagar",      lat: 23.2000, lng: 72.6300 },
  thaltej:      { label: "Thaltej, Ahmedabad",          lat: 23.0530, lng: 72.5100 },
  kudasan:      { label: "Kudasan, Gandhinagar",        lat: 23.1780, lng: 72.6350 },
};

const hash = (p) => bcrypt.hashSync(p, 10);
const hoursFromNow = (h) => new Date(Date.now() + h * 3600_000);
const daysAgo = (d) => new Date(Date.now() - d * 86400_000);

async function main() {
  console.log("Seeding…");

  // Idempotent: remove the org and let cascades clear everything beneath it.
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

  const mk = (name, email, extra = {}) => ({
    orgId: org.id,
    name,
    email,
    passwordHash: hash(extra.password ?? "password123"),
    phone: extra.phone ?? "+919876543210",
    department: extra.department ?? "Engineering",
    officeLocation: extra.officeLocation ?? "Ahmedabad",
    manager: extra.manager ?? "S. Naik",
    employeeCode: extra.employeeCode,
    role: extra.role ?? "EMPLOYEE",
    avatarColor: extra.avatarColor ?? "#286b57",
    wallet: { create: { balance: extra.balance ?? 500 } },
  });

  const shrey = await prisma.user.create({
    data: mk("Shrey Naik", "shrey@northbridge.in", {
      password: "admin123",
      role: "ADMIN",
      department: "Administration",
      employeeCode: "NB001",
      phone: "+919825011001",
      avatarColor: "#1f6b51",
    }),
  });

  const prayag = await prisma.user.create({
    data: mk("Prayag Panchani", "prayag@northbridge.in", {
      employeeCode: "NB002",
      phone: "+919825011002",
      avatarColor: "#2563eb",
      balance: 750,
    }),
  });

  const saad = await prisma.user.create({
    data: mk("Saad Mandli", "saad@northbridge.in", {
      department: "Product",
      employeeCode: "NB003",
      phone: "+919825011003",
      avatarColor: "#7c3aed",
      balance: 1200,
    }),
  });

  // Two more employees so the leaderboard, department breakdown and admin
  // roster look like a real organisation rather than a three-row table.
  const ishita = await prisma.user.create({
    data: mk("Ishita Rao", "ishita@northbridge.in", {
      department: "Finance",
      officeLocation: "Gandhinagar",
      employeeCode: "NB004",
      phone: "+919825011004",
      avatarColor: "#db2777",
      balance: 320,
    }),
  });

  const devansh = await prisma.user.create({
    data: mk("Devansh Mehta", "devansh@northbridge.in", {
      department: "Sales",
      employeeCode: "NB005",
      phone: "+919825011005",
      avatarColor: "#ea580c",
      balance: 150,
    }),
  });

  // ------------------------------------------------------------- vehicles
  const swift = await prisma.vehicle.create({
    data: {
      userId: prayag.id,
      model: "Maruti Swift",
      registrationNumber: "GJ18AB4471",
      seatingCapacity: 4,
      fuelType: "Petrol",
      mileageKmpl: 21.2,
      color: "White",
    },
  });

  const i20 = await prisma.vehicle.create({
    data: {
      userId: saad.id,
      model: "Hyundai i20",
      registrationNumber: "GJ01CD9032",
      seatingCapacity: 4,
      fuelType: "Petrol",
      mileageKmpl: 19.4,
      color: "Grey",
    },
  });

  await prisma.vehicle.create({
    data: {
      userId: ishita.id,
      model: "Tata Nexon",
      registrationNumber: "GJ27EF1188",
      seatingCapacity: 4,
      fuelType: "Diesel",
      mileageKmpl: 17.6,
      color: "Blue",
    },
  });

  // ---------------------------------------------------------- saved places
  for (const user of [prayag, saad, ishita, devansh]) {
    await prisma.savedPlace.createMany({
      data: [
        { userId: user.id, label: "Home", address: PLACES.bopal.label, lat: PLACES.bopal.lat, lng: PLACES.bopal.lng },
        { userId: user.id, label: "Office", address: PLACES.giftCity.label, lat: PLACES.giftCity.lat, lng: PLACES.giftCity.lng },
      ],
    });
  }

  // --------------------------------------------------- upcoming (bookable)
  const upcoming = [
    { driver: prayag, vehicle: swift, from: PLACES.bopal, to: PLACES.giftCity, inHours: 3, seats: 3, fare: 110 },
    { driver: saad, vehicle: i20, from: PLACES.bopal, to: PLACES.giftCity, inHours: 4, seats: 2, fare: 95 },
    { driver: prayag, vehicle: swift, from: PLACES.thaltej, to: PLACES.sector21, inHours: 6, seats: 4, fare: 140 },
    { driver: saad, vehicle: i20, from: PLACES.prahladNagar, to: PLACES.kudasan, inHours: 24, seats: 3, fare: 125 },
  ];

  for (const r of upcoming) {
    await prisma.ride.create({
      data: {
        orgId: org.id,
        driverId: r.driver.id,
        vehicleId: r.vehicle.id,
        originLabel: r.from.label,
        originLat: r.from.lat,
        originLng: r.from.lng,
        destLabel: r.to.label,
        destLat: r.to.lat,
        destLng: r.to.lng,
        departureAt: hoursFromNow(r.inHours),
        totalSeats: r.seats,
        seatsLeft: r.seats,
        farePerSeat: r.fare,
        distanceKm: estimateKm(r.from, r.to),
        durationMin: Math.round((estimateKm(r.from, r.to) / 28) * 60),
      },
    });
  }

  // ------------------------------------------ completed history for reports
  // Reports are computed from real trip rows, so the dashboard needs a past.
  const riders = [saad, ishita, devansh];
  for (let i = 1; i <= 9; i++) {
    const driver = i % 2 === 0 ? saad : prayag;
    const vehicle = i % 2 === 0 ? i20 : swift;
    const from = i % 3 === 0 ? PLACES.thaltej : PLACES.bopal;
    const to = i % 3 === 0 ? PLACES.sector21 : PLACES.giftCity;
    const km = estimateKm(from, to);
    const fare = 95 + (i % 3) * 15;
    const at = daysAgo(i * 7);

    const ride = await prisma.ride.create({
      data: {
        orgId: org.id,
        driverId: driver.id,
        vehicleId: vehicle.id,
        originLabel: from.label,
        originLat: from.lat,
        originLng: from.lng,
        destLabel: to.label,
        destLat: to.lat,
        destLng: to.lng,
        departureAt: at,
        totalSeats: 3,
        seatsLeft: 1,
        farePerSeat: fare,
        distanceKm: km,
        durationMin: Math.round((km / 28) * 60),
        status: "COMPLETED",
        startedAt: at,
        completedAt: new Date(at.getTime() + 45 * 60_000),
      },
    });

    const passenger = riders.filter((p) => p.id !== driver.id)[i % 2];
    const booking = await prisma.booking.create({
      data: {
        rideId: ride.id,
        passengerId: passenger.id,
        seats: 1,
        fareAmount: fare,
        pickupLabel: from.label,
        pickupLat: from.lat,
        pickupLng: from.lng,
        dropLabel: to.label,
        dropLat: to.lat,
        dropLng: to.lng,
        status: "COMPLETED",
      },
    });

    await prisma.payment.create({
      data: {
        bookingId: booking.id,
        amount: fare,
        method: ["WALLET", "UPI", "CASH", "CARD"][i % 4],
        status: "COMPLETED",
        paidAt: new Date(at.getTime() + 50 * 60_000),
      },
    });
  }

  console.log(`
Seed complete — ${org.name}

  Admin     shrey@northbridge.in     / admin123
  Driver    prayag@northbridge.in    / password123   (Maruti Swift GJ18AB4471)
  Driver    saad@northbridge.in      / password123   (Hyundai i20 GJ01CD9032)
  Employee  ishita@northbridge.in    / password123
  Employee  devansh@northbridge.in   / password123

  ${upcoming.length} bookable rides, 9 completed trips behind the reports.
`);
}

// Straight line plus a city detour factor. Real distances come from the
// routing service when a ride is published; the seed must not need network.
function estimateKm(a, b) {
  const R = 6371;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.sqrt(s)) * 1.3 * 100) / 100;
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
