-- DropIndex
DROP INDEX "Pilot_isAvailable_currentLocation_idx";

-- AlterTable
ALTER TABLE "Booking" ALTER COLUMN "pickupLocation" DROP NOT NULL,
ALTER COLUMN "pickupLocation" SET DATA TYPE TEXT,
ALTER COLUMN "dropLocation" DROP NOT NULL,
ALTER COLUMN "dropLocation" SET DATA TYPE TEXT;

-- AlterTable
ALTER TABLE "Pilot" ALTER COLUMN "currentLocation" SET DATA TYPE TEXT;

-- AlterTable
ALTER TABLE "SavedPlace" ALTER COLUMN "location" SET DATA TYPE TEXT;

-- CreateIndex
CREATE INDEX "Pilot_isAvailable_idx" ON "Pilot"("isAvailable");
