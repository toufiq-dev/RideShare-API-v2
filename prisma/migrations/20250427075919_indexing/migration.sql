/*
  Warnings:

  - You are about to drop the column `comment` on the `CustomerRating` table. All the data in the column will be lost.
  - You are about to drop the column `comment` on the `PilotRating` table. All the data in the column will be lost.
  - You are about to drop the `Feedback` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "Feedback" DROP CONSTRAINT "Feedback_customerRatingId_fkey";

-- DropForeignKey
ALTER TABLE "Feedback" DROP CONSTRAINT "Feedback_pilotRatingId_fkey";

-- DropIndex
DROP INDEX "Booking_customerId_idx";

-- DropIndex
DROP INDEX "Booking_pilotId_idx";

-- DropIndex
DROP INDEX "Booking_status_idx";

-- DropIndex
DROP INDEX "DrivingLicense_licenseNumber_idx";

-- DropIndex
DROP INDEX "Pilot_currentLocation_idx";

-- DropIndex
DROP INDEX "Pilot_onlineStatus_idx";

-- DropIndex
DROP INDEX "VehicleType_name_idx";

-- AlterTable
ALTER TABLE "CustomerRating" DROP COLUMN "comment",
ADD COLUMN     "feedback" TEXT;

-- AlterTable
ALTER TABLE "PilotRating" DROP COLUMN "comment",
ADD COLUMN     "feedback" TEXT;

-- DropTable
DROP TABLE "Feedback";

-- CreateIndex
CREATE INDEX "Booking_customerId_status_idx" ON "Booking"("customerId", "status");

-- CreateIndex
CREATE INDEX "Booking_pilotId_status_idx" ON "Booking"("pilotId", "status");
