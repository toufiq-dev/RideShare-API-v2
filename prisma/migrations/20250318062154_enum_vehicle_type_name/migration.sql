/*
  Warnings:

  - Changed the type of `name` on the `VehicleType` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- CreateEnum
CREATE TYPE "VehicleTypeName" AS ENUM ('HATCHBACK', 'SEDAN', 'SUV', 'KALIPEELI', 'AUTORICKSHAW', 'OTHER');

-- AlterTable
ALTER TABLE "VehicleType" DROP COLUMN "name",
ADD COLUMN     "name" "VehicleTypeName" NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "VehicleType_name_key" ON "VehicleType"("name");
