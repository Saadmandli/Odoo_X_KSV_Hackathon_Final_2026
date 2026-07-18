-- CreateTable
CREATE TABLE "ratings" (
    "id" TEXT NOT NULL,
    "rideId" TEXT NOT NULL,
    "raterId" TEXT NOT NULL,
    "driverId" TEXT NOT NULL,
    "stars" INTEGER NOT NULL,
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ratings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ratings_driverId_idx" ON "ratings"("driverId");

-- CreateIndex
CREATE UNIQUE INDEX "ratings_rideId_raterId_key" ON "ratings"("rideId", "raterId");

-- AddForeignKey
ALTER TABLE "ratings" ADD CONSTRAINT "ratings_rideId_fkey" FOREIGN KEY ("rideId") REFERENCES "rides"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ratings" ADD CONSTRAINT "ratings_raterId_fkey" FOREIGN KEY ("raterId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ratings" ADD CONSTRAINT "ratings_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

