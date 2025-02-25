/*
  Warnings:

  - You are about to alter the column `estimatedFare` on the `Booking` table. The data in that column could be lost. The data in that column will be cast from `DoublePrecision` to `Decimal(10,2)`.
  - You are about to alter the column `fare` on the `Booking` table. The data in that column could be lost. The data in that column will be cast from `DoublePrecision` to `Decimal(10,2)`.
  - You are about to alter the column `surgeMultiplier` on the `Booking` table. The data in that column could be lost. The data in that column will be cast from `DoublePrecision` to `Decimal(10,2)`.
  - You are about to alter the column `discount` on the `Booking` table. The data in that column could be lost. The data in that column will be cast from `DoublePrecision` to `Decimal(10,2)`.
  - The `isAvailable` column on the `Pilot` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- CreateEnum
CREATE TYPE "PilotStatus" AS ENUM ('AVAILABLE', 'ON_TRIP', 'OFFLINE');

-- AlterTable
ALTER TABLE "Booking" ADD COLUMN     "acceptedAt" TIMESTAMP(3),
ADD COLUMN     "arrivedAt" TIMESTAMP(3),
ALTER COLUMN "estimatedFare" SET DATA TYPE DECIMAL(10,2),
ALTER COLUMN "fare" SET DATA TYPE DECIMAL(10,2),
ALTER COLUMN "surgeMultiplier" SET DATA TYPE DECIMAL(10,2),
ALTER COLUMN "discount" SET DATA TYPE DECIMAL(10,2);

-- AlterTable
ALTER TABLE "Pilot" DROP COLUMN "isAvailable",
ADD COLUMN     "isAvailable" "PilotStatus" NOT NULL DEFAULT 'OFFLINE';

-- AlterTable
ALTER TABLE "Transaction" ADD COLUMN     "balanceAfter" DECIMAL(10,2),
ADD COLUMN     "balanceBefore" DECIMAL(10,2);

-- DropEnum
DROP TYPE "DocumentType";

-- CreateIndex
CREATE INDEX "Pilot_phone_idx" ON "Pilot"("phone");

-- CreateIndex
CREATE INDEX "Pilot_isAvailable_idx" ON "Pilot"("isAvailable");
