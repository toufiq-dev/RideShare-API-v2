-- AlterTable
ALTER TABLE "Booking" ADD COLUMN     "vehicleTypeIdBD" TEXT;

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_vehicleTypeIdBD_fkey" FOREIGN KEY ("vehicleTypeIdBD") REFERENCES "VehicleTypeBD"("id") ON DELETE SET NULL ON UPDATE CASCADE;
