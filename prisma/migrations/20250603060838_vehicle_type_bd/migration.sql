-- CreateEnum
CREATE TYPE "VehicleTypeNameBD" AS ENUM ('FAIR_BIKE', 'FAIR_PRIME', 'FAIR_PLUS', 'FAIR_MAX', 'FAIR_CNG');

-- DropForeignKey
ALTER TABLE "Vehicle" DROP CONSTRAINT "Vehicle_vehicleTypeId_fkey";

-- AlterTable
ALTER TABLE "Vehicle" ADD COLUMN     "vehicleTypeIdBD" TEXT,
ALTER COLUMN "vehicleTypeId" DROP NOT NULL;

-- CreateTable
CREATE TABLE "VehicleTypeBD" (
    "id" TEXT NOT NULL,
    "name" "VehicleTypeNameBD" NOT NULL,
    "airCondition" TEXT[],
    "isFaster" BOOLEAN NOT NULL,
    "passengerCapacity" INTEGER NOT NULL,
    "baseFare" DECIMAL(10,2),
    "perKmRate" DECIMAL(10,2),
    "perMinRate" DECIMAL(10,2),

    CONSTRAINT "VehicleTypeBD_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "VehicleTypeBD_name_key" ON "VehicleTypeBD"("name");

-- AddForeignKey
ALTER TABLE "Vehicle" ADD CONSTRAINT "Vehicle_vehicleTypeId_fkey" FOREIGN KEY ("vehicleTypeId") REFERENCES "VehicleType"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Vehicle" ADD CONSTRAINT "Vehicle_vehicleTypeIdBD_fkey" FOREIGN KEY ("vehicleTypeIdBD") REFERENCES "VehicleTypeBD"("id") ON DELETE SET NULL ON UPDATE CASCADE;
