/*
  Warnings:

  - You are about to drop the column `lastTripEarning` on the `PilotWallet` table. All the data in the column will be lost.
  - You are about to drop the column `todaysEarning` on the `PilotWallet` table. All the data in the column will be lost.
  - You are about to drop the column `userId` on the `Transaction` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[pilotId]` on the table `PilotTripEarning` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[walletId]` on the table `PilotTripEarning` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `walletId` to the `PilotTripEarning` table without a default value. This is not possible if the table is not empty.
  - Added the required column `pilotId` to the `Transaction` table without a default value. This is not possible if the table is not empty.
  - Added the required column `status` to the `Transaction` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "TransactionStatus" AS ENUM ('PENDING', 'SUCCESSFULL', 'FAILED');

-- DropForeignKey
ALTER TABLE "Transaction" DROP CONSTRAINT "Transaction_userId_fkey";

-- AlterTable
ALTER TABLE "PilotTripEarning" ADD COLUMN     "walletId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "PilotWallet" DROP COLUMN "lastTripEarning",
DROP COLUMN "todaysEarning",
ALTER COLUMN "minusLimit" SET DEFAULT 100.00;

-- AlterTable
ALTER TABLE "Transaction" DROP COLUMN "userId",
ADD COLUMN     "pilotId" TEXT NOT NULL,
ADD COLUMN     "status" "TransactionStatus" NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "PilotTripEarning_pilotId_key" ON "PilotTripEarning"("pilotId");

-- CreateIndex
CREATE UNIQUE INDEX "PilotTripEarning_walletId_key" ON "PilotTripEarning"("walletId");

-- AddForeignKey
ALTER TABLE "PilotTripEarning" ADD CONSTRAINT "PilotTripEarning_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "PilotWallet"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_pilotId_fkey" FOREIGN KEY ("pilotId") REFERENCES "Pilot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
