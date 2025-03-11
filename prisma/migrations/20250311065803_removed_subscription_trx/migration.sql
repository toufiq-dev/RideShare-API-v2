/*
  Warnings:

  - You are about to drop the `SubscriptionTransaction` table. If the table is not empty, all the data it contains will be lost.
  - Added the required column `updatedAt` to the `PilotTripEarning` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `Support` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "SubscriptionTransaction" DROP CONSTRAINT "SubscriptionTransaction_subscriptionId_fkey";

-- DropForeignKey
ALTER TABLE "Transaction" DROP CONSTRAINT "Transaction_subscriptionId_fkey";

-- AlterTable
ALTER TABLE "PilotTripEarning" ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- AlterTable
ALTER TABLE "PilotWallet" ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "Support" ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- AlterTable
ALTER TABLE "Transaction" ADD COLUMN     "order_id" TEXT;

-- DropTable
DROP TABLE "SubscriptionTransaction";

-- DropEnum
DROP TYPE "PaymentStatus";

-- AddForeignKey
ALTER TABLE "PilotWallet" ADD CONSTRAINT "PilotWallet_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "Subscription"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "Subscription"("id") ON DELETE SET NULL ON UPDATE CASCADE;
