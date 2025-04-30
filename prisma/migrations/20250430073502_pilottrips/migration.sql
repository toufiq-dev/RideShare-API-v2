/*
  Warnings:

  - You are about to drop the column `totalTrips` on the `Pilot` table. All the data in the column will be lost.
  - You are about to drop the `PilotTripEarning` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "PilotTripEarning" DROP CONSTRAINT "PilotTripEarning_pilotId_fkey";

-- DropForeignKey
ALTER TABLE "PilotTripEarning" DROP CONSTRAINT "PilotTripEarning_walletId_fkey";

-- AlterTable
ALTER TABLE "Pilot" DROP COLUMN "totalTrips";

-- DropTable
DROP TABLE "PilotTripEarning";

-- CreateTable
CREATE TABLE "PilotTrips" (
    "id" TEXT NOT NULL,
    "pilotId" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "totalTrips" INTEGER NOT NULL DEFAULT 0,
    "date" TIMESTAMPTZ NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "PilotTrips_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PilotTrips_pilotId_date_idx" ON "PilotTrips"("pilotId", "date");

-- AddForeignKey
ALTER TABLE "PilotTrips" ADD CONSTRAINT "PilotTrips_pilotId_fkey" FOREIGN KEY ("pilotId") REFERENCES "Pilot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
