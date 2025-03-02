/*
  Warnings:

  - Added the required column `seatCapacity` to the `Vehicle` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Vehicle" ADD COLUMN     "seatCapacity" TEXT NOT NULL;
