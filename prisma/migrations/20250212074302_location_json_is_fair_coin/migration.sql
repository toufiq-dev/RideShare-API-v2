/*
  Warnings:

  - The `currentLocation` column on the `Pilot` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `location` column on the `SavedPlace` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `location` column on the `UserSession` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - Added the required column `pickupLocation` to the `Booking` table without a default value. This is not possible if the table is not empty.
  - Added the required column `dropLocation` to the `Booking` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Booking" DROP COLUMN "pickupLocation",
ADD COLUMN     "pickupLocation" JSONB NOT NULL,
DROP COLUMN "dropLocation",
ADD COLUMN     "dropLocation" JSONB NOT NULL;

-- AlterTable
ALTER TABLE "Pilot" ADD COLUMN     "isFairCoinAvailed" BOOLEAN NOT NULL DEFAULT false,
DROP COLUMN "currentLocation",
ADD COLUMN     "currentLocation" JSONB;

-- AlterTable
ALTER TABLE "SavedPlace" DROP COLUMN "location",
ADD COLUMN     "location" JSONB;

-- AlterTable
ALTER TABLE "UserSession" DROP COLUMN "location",
ADD COLUMN     "location" JSONB;

-- CreateIndex
CREATE INDEX "UserSession_location_idx" ON "UserSession"("location");
