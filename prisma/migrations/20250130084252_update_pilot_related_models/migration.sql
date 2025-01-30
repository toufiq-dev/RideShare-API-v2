/*
  Warnings:

  - You are about to drop the column `subscriptionTypeId` on the `PilotSubscription` table. All the data in the column will be lost.
  - You are about to drop the `SubscriptionType` table. If the table is not empty, all the data it contains will be lost.
  - A unique constraint covering the columns `[name]` on the table `PilotSubscription` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `coins` to the `PilotSubscription` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "PilotSubscription" DROP CONSTRAINT "PilotSubscription_subscriptionTypeId_fkey";

-- DropIndex
DROP INDEX "PilotSubscription_subscriptionTypeId_key";

-- AlterTable
ALTER TABLE "PilotSubscription" DROP COLUMN "subscriptionTypeId",
ADD COLUMN     "coins" INTEGER NOT NULL;

-- DropTable
DROP TABLE "SubscriptionType";

-- CreateIndex
CREATE UNIQUE INDEX "PilotSubscription_name_key" ON "PilotSubscription"("name");
