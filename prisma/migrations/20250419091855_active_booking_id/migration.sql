/*
  Warnings:

  - A unique constraint covering the columns `[activeBookingId]` on the table `Customer` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "Customer" ADD COLUMN     "activeBookingId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Customer_activeBookingId_key" ON "Customer"("activeBookingId");

-- AddForeignKey
ALTER TABLE "Customer" ADD CONSTRAINT "Customer_activeBookingId_fkey" FOREIGN KEY ("activeBookingId") REFERENCES "Booking"("id") ON DELETE SET NULL ON UPDATE CASCADE;
