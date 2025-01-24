/*
  Warnings:

  - Made the column `vehicleTypeId` on table `Vehicle` required. This step will fail if there are existing NULL values in that column.

*/
-- DropForeignKey
ALTER TABLE "Vehicle" DROP CONSTRAINT "Vehicle_vehicleTypeId_fkey";

-- AlterTable
ALTER TABLE "Vehicle" ALTER COLUMN "vehicleTypeId" SET NOT NULL;

-- AddForeignKey
ALTER TABLE "Vehicle" ADD CONSTRAINT "Vehicle_vehicleTypeId_fkey" FOREIGN KEY ("vehicleTypeId") REFERENCES "VehicleType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
