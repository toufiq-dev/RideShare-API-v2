/*
  Warnings:

  - You are about to drop the column `riderName` on the `Booking` table. All the data in the column will be lost.
  - You are about to drop the column `riderPhone` on the `Booking` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[activeBookingId]` on the table `Pilot` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "Booking" DROP COLUMN "riderName",
DROP COLUMN "riderPhone";

-- AlterTable
ALTER TABLE "Pilot" ADD COLUMN     "activeBookingId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Pilot_activeBookingId_key" ON "Pilot"("activeBookingId");

-- AddForeignKey
ALTER TABLE "Pilot" ADD CONSTRAINT "Pilot_activeBookingId_fkey" FOREIGN KEY ("activeBookingId") REFERENCES "Booking"("id") ON DELETE SET NULL ON UPDATE CASCADE;
