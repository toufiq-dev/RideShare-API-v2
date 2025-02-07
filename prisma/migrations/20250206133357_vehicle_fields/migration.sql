/*
  Warnings:

  - You are about to drop the column `capacity` on the `Vehicle` table. All the data in the column will be lost.
  - You are about to drop the column `fuelDesc` on the `Vehicle` table. All the data in the column will be lost.
  - You are about to drop the column `permitExpiry` on the `Vehicle` table. All the data in the column will be lost.
  - Added the required column `regUpto` to the `Vehicle` table without a default value. This is not possible if the table is not empty.
  - Added the required column `vehicleState` to the `Vehicle` table without a default value. This is not possible if the table is not empty.
  - Made the column `insuranceUpto` on table `Vehicle` required. This step will fail if there are existing NULL values in that column.
  - Made the column `manufacturer` on table `Vehicle` required. This step will fail if there are existing NULL values in that column.
  - Made the column `registrationExpiry` on table `Vehicle` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "Vehicle" DROP COLUMN "capacity",
DROP COLUMN "fuelDesc",
DROP COLUMN "permitExpiry",
ADD COLUMN     "permitUpto" TEXT,
ADD COLUMN     "regUpto" TEXT NOT NULL,
ADD COLUMN     "vehicleSeatingCapacity" INTEGER,
ADD COLUMN     "vehicleState" TEXT NOT NULL,
ALTER COLUMN "insuranceUpto" SET NOT NULL,
ALTER COLUMN "manufacturer" SET NOT NULL,
ALTER COLUMN "registrationExpiry" SET NOT NULL;
