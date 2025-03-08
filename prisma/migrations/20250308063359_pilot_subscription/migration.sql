/*
  Warnings:

  - You are about to drop the column `description` on the `PilotEarning` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "PilotEarning" DROP COLUMN "description";

-- AlterTable
ALTER TABLE "PilotSubscription" ADD COLUMN     "description" TEXT;
