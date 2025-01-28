/*
  Warnings:

  - You are about to drop the column `coins` on the `PilotSubscription` table. All the data in the column will be lost.
  - You are about to drop the column `description` on the `PilotSubscription` table. All the data in the column will be lost.
  - You are about to drop the column `features` on the `PilotSubscription` table. All the data in the column will be lost.
  - You are about to drop the column `isActive` on the `PilotSubscription` table. All the data in the column will be lost.
  - You are about to drop the column `price` on the `PilotSubscription` table. All the data in the column will be lost.
  - You are about to drop the column `description` on the `Transaction` table. All the data in the column will be lost.
  - Added the required column `name` to the `PilotSubscription` table without a default value. This is not possible if the table is not empty.
  - Added the required column `subscriptionId` to the `PilotWallet` table without a default value. This is not possible if the table is not empty.
  - Added the required column `coins` to the `SubscriptionType` table without a default value. This is not possible if the table is not empty.
  - Added the required column `description` to the `SubscriptionType` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "SavedPlaceType" AS ENUM ('HOME', 'WORK', 'RESTAURANT', 'GYM', 'COLLEGE', 'OTHERS');

-- AlterTable
ALTER TABLE "PilotSubscription" DROP COLUMN "coins",
DROP COLUMN "description",
DROP COLUMN "features",
DROP COLUMN "isActive",
DROP COLUMN "price",
ADD COLUMN     "name" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "PilotWallet" ADD COLUMN     "subscriptionId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "SavedPlace" ADD COLUMN     "type" "SavedPlaceType" NOT NULL DEFAULT 'OTHERS';

-- AlterTable
ALTER TABLE "SubscriptionType" ADD COLUMN     "coins" INTEGER NOT NULL,
ADD COLUMN     "description" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "Transaction" DROP COLUMN "description",
ADD COLUMN     "subscriptionId" TEXT;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "SubscriptionTransaction"("id") ON DELETE SET NULL ON UPDATE CASCADE;
