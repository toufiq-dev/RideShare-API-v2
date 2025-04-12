/*
  Warnings:

  - You are about to drop the column `cancellationReasonId` on the `Booking` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[bookingId]` on the table `CancellationReason` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `cancelledBy` to the `CancellationReason` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "CancelledBy" AS ENUM ('PILOT', 'CUSTOMER', 'SYSTEM', 'SUPPORT');

-- DropForeignKey
ALTER TABLE "Booking" DROP CONSTRAINT "Booking_cancellationReasonId_fkey";

-- AlterTable
ALTER TABLE "Booking" DROP COLUMN "cancellationReasonId";

-- AlterTable
ALTER TABLE "CancellationReason" ADD COLUMN     "cancelledBy" "CancelledBy" NOT NULL,
ADD COLUMN     "supportId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "CancellationReason_bookingId_key" ON "CancellationReason"("bookingId");

-- AddForeignKey
ALTER TABLE "CancellationReason" ADD CONSTRAINT "CancellationReason_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CancellationReason" ADD CONSTRAINT "CancellationReason_supportId_fkey" FOREIGN KEY ("supportId") REFERENCES "Support"("id") ON DELETE SET NULL ON UPDATE CASCADE;
