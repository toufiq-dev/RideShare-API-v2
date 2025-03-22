/*
  Warnings:

  - You are about to drop the column `isAvailable` on the `Pilot` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "Pilot_isAvailable_idx";

-- AlterTable
ALTER TABLE "Pilot" DROP COLUMN "isAvailable",
ADD COLUMN     "onlineStatus" "PilotStatus" NOT NULL DEFAULT 'OFFLINE';

-- CreateIndex
CREATE INDEX "Pilot_onlineStatus_idx" ON "Pilot"("onlineStatus");
