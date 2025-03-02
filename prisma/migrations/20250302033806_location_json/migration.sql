/*
  Warnings:

  - Changed the type of `pickupLocation` on the `Booking` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `dropLocation` on the `Booking` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Made the column `location` on table `SavedPlace` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "Booking" DROP COLUMN "pickupLocation",
ADD COLUMN     "pickupLocation" JSONB NOT NULL,
DROP COLUMN "dropLocation",
ADD COLUMN     "dropLocation" JSONB NOT NULL;

-- AlterTable
ALTER TABLE "SavedPlace" ALTER COLUMN "location" SET NOT NULL,
ALTER COLUMN "location" SET DATA TYPE TEXT;
