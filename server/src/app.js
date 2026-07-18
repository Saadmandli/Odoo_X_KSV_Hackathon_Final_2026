import express from "express";
import cors from "cors";

import authRoutes from "./routes/auth.routes.js";
import ridesRoutes from "./routes/rides.routes.js";
import bookingsRoutes from "./routes/bookings.routes.js";
import vehiclesRoutes from "./routes/vehicles.routes.js";
import paymentsRoutes from "./routes/payments.routes.js";
import placesRoutes from "./routes/places.routes.js";
import reportsRoutes from "./routes/reports.routes.js";
import adminRoutes from "./routes/admin.routes.js";
import notificationsRoutes from "./routes/notifications.routes.js";
import publicRoutes from "./routes/public.routes.js";
import ratingsRoutes from "./routes/ratings.routes.js";

export const app = express(); 

const origins = (process.env.CORS_ORIGINS || "*").split(",").map((s) => s.trim());
app.use(cors({ origin: origins.includes("*") ? true : origins, credentials: true }));
app.use(express.json());

// Kept trivial and dependency-free: this is what the uptime pinger hits, so it
// must answer even when the database is down.
app.get("/api/health", (_req, res) => res.json({ ok: true, at: new Date().toISOString() }));

// Mounted before the authenticated routers: this is the shared tracking link.
app.use("/api/public", publicRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/rides", ridesRoutes);
app.use("/api/bookings", bookingsRoutes);
app.use("/api/vehicles", vehiclesRoutes);
app.use("/api/payments", paymentsRoutes);
app.use("/api/places", placesRoutes);
app.use("/api/reports", reportsRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/notifications", notificationsRoutes);
app.use("/api/ratings", ratingsRoutes);

app.use((req, res) => res.status(404).json({ error: `No route for ${req.method} ${req.path}` }));

// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  console.error("[error]", err);
  res.status(err.status || 500).json({ error: err.message || "Internal server error" });
});
