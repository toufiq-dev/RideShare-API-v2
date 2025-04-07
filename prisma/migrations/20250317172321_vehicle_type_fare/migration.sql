-- AlterTable
ALTER TABLE "VehicleType" ADD COLUMN     "baseFare" DECIMAL(10,2),
ADD COLUMN     "perKmRate" DECIMAL(10,2),
ADD COLUMN     "perMinRate" DECIMAL(10,2);
