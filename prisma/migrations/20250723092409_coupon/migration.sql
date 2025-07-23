/*
  Warnings:

  - You are about to drop the column `discount` on the `PilotCoupon` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "PilotCoupon" DROP COLUMN "discount",
ADD COLUMN     "description" TEXT,
ADD COLUMN     "subscriptionId" TEXT;

-- AddForeignKey
ALTER TABLE "PilotCoupon" ADD CONSTRAINT "PilotCoupon_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "Subscription"("id") ON DELETE SET NULL ON UPDATE CASCADE;
