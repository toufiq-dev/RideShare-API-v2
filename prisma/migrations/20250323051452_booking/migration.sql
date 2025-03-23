/*
  Warnings:

  - You are about to drop the column `actualDistance` on the `Booking` table. All the data in the column will be lost.
  - You are about to drop the column `actualDuration` on the `Booking` table. All the data in the column will be lost.
  - You are about to drop the column `scheduledFor` on the `Booking` table. All the data in the column will be lost.
  - Added the required column `distance` to the `Booking` table without a default value. This is not possible if the table is not empty.
  - Added the required column `rideType` to the `Booking` table without a default value. This is not possible if the table is not empty.
  - Made the column `estimatedFare` on table `Booking` required. This step will fail if there are existing NULL values in that column.
  - Made the column `fare` on table `Booking` required. This step will fail if there are existing NULL values in that column.

*/
-- CreateEnum
CREATE TYPE "RideType" AS ENUM ('SELF', 'OTHERS');

-- AlterTable
ALTER TABLE "Booking" DROP COLUMN "actualDistance",
DROP COLUMN "actualDuration",
DROP COLUMN "scheduledFor",
ADD COLUMN     "distance" TEXT NOT NULL,
ADD COLUMN     "estimatedDuration" INTEGER,
ADD COLUMN     "rideType" "RideType" NOT NULL,
ALTER COLUMN "estimatedFare" SET NOT NULL,
ALTER COLUMN "fare" SET NOT NULL;
