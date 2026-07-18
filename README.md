# Odoo x KSV Hackathon Final 2026 — Carpooling Platform

Enterprise carpooling for registered organisations. Employees discover and share
rides, track trips live, and settle fares, all scoped to their own company.

**Stack:** PostgreSQL, Express, React (Vite), Node, with Prisma.
Maps use Leaflet with OpenStreetMap and OSRM, so there are no API keys to manage.

## Run locally

Two terminals.

```bash
# 1 — API  (http://localhost:4000)
cd server
npm install
npm run db:push     # creates the tables
npm run db:seed     # demo organisation, employees, vehicles, rides, history
npm run dev

# 2 — web  (http://localhost:5173)
cd client
npm install
npm run dev
```

### Demo accounts

| Role | Email | Password |
|---|---|---|
| Admin | `shrey@northbridge.in` | `admin123` |
| Driver | `prayag@northbridge.in` | `password123` |
| Driver | `saad@northbridge.in` | `password123` |
| Employee | `ishita@northbridge.in` | `password123` |
| Employee | `devansh@northbridge.in` | `password123` |

Signup is restricted to registered email domains. `@northbridge.in` works,
anything else is rejected. That restriction is what makes the platform
multi-tenant.

## Environment

Copy `server/.env.example` to `server/.env` and `client/.env.example` to
`client/.env`.

> The database variable is `CARPOOL_DATABASE_URL`, not `DATABASE_URL`. Real
> environment variables take precedence over `.env` files in both Prisma and
> dotenv, so a project-specific name cannot be shadowed by something already set
> on the machine.

`VITE_` values are inlined at **build** time, so `VITE_API_URL` must be set in
the host's environment before the production build runs.

## How it works

**Multi-tenancy.** Every request resolves the caller's organisation in
`requireAuth`, and every query filters on it. Employees join an organisation by
their email domain.

**Live tracking is polled, not socket based.** The driver's device posts its
position every few seconds and participants read the latest one. There is no
connection to drop and no reconnect logic, and it behaves the same on every
host. Only the driver and booked passengers can read a position, and only while
the trip is active.

**Maps degrade instead of failing.** `lib/geo.js` calls the routing service with
a six second timeout; if it is unreachable it falls back to a great-circle
estimate with a road detour factor, so a ride can always be published.
Geocoding is proxied through the server because the geocoder requires a
`User-Agent` a browser cannot set, and responses are cached and debounced to
respect its rate limit.

**Seat booking is race safe.** Booking runs in a transaction with a conditional
decrement, so two passengers claiming the last seat at the same moment cannot
both succeed.

**Pickup order is optimised.** With several passengers, booking order is rarely
travel order. `lib/pickupPlan.js` solves the open path from origin to
destination with nearest neighbour followed by 2-opt.

**Shared tracking links.** A rider can share a read-only live link with family.
It needs no account, exposes only a first name and the vehicle plate, and stops
returning a position once the trip ends.

## Tests

End-to-end checks covering the full business flow: authentication, publishing,
search, booking, the trip lifecycle, tracking permissions, chat, wallet
payments, reports, route optimisation and admin access control.

```bash
cd server
npm run dev                        # in one shell
node ../scripts/smoke.mjs          # in another
node ../scripts/smoke-features.mjs
node ../scripts/smoke-advanced.mjs
```
