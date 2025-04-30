/*
  Warnings:

  - Added the required column `updatedAt` to the `PilotWallet` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "PilotWallet" ADD COLUMN     "date" TIMESTAMPTZ,
ADD COLUMN     "lastTripEarning" DECIMAL(10,2) DEFAULT 0.00,
ADD COLUMN     "todaysEarning" DECIMAL(10,2) DEFAULT 0.00,
ADD COLUMN     "updatedAt" TIMESTAMPTZ NOT NULL,
ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMPTZ;
