-- AlterTable
ALTER TABLE "Booking" ALTER COLUMN "pickupLocation" SET DATA TYPE TEXT,
ALTER COLUMN "dropLocation" SET DATA TYPE TEXT;

-- CreateIndex
CREATE INDEX "Pilot_currentLocation_idx" ON "Pilot"("currentLocation");
