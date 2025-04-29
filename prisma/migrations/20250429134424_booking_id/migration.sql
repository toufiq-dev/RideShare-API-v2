/*
  Warnings:

  - Added the required column `bookingId` to the `PilotTripEarning` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "PilotTripEarning" ADD COLUMN     "bookingId" TEXT NOT NULL;
