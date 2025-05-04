/*
  Warnings:

  - You are about to drop the column `totalTrips` on the `PilotTrips` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Pilot" ADD COLUMN     "totalTrips" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "PilotTrips" DROP COLUMN "totalTrips";
