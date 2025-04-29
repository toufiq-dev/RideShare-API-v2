-- DropIndex
DROP INDEX "PilotTripEarning_pilotId_key";

-- AlterTable
ALTER TABLE "PilotTripEarning" ALTER COLUMN "date" SET DATA TYPE TIMESTAMPTZ;
