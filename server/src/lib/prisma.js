import { PrismaClient } from "@prisma/client";

// Serverless invocations reuse the module instance when warm, and nodemon
// re-imports on every restart. Without this singleton both cases open a fresh
// pool each time and exhaust Postgres connections.
const globalForPrisma = globalThis;

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "production" ? ["error"] : ["error", "warn"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
