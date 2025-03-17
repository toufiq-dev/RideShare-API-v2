/*
  Warnings:

  - You are about to drop the column `token` on the `DeviceToken` table. All the data in the column will be lost.
  - You are about to drop the `UserSession` table. If the table is not empty, all the data it contains will be lost.
  - A unique constraint covering the columns `[fcmToken]` on the table `DeviceToken` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `fcmToken` to the `DeviceToken` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "UserSession" DROP CONSTRAINT "UserSession_userId_fkey";

-- DropIndex
DROP INDEX "DeviceToken_token_key";

-- DropIndex
DROP INDEX "Pilot_referralCode_key";

-- AlterTable
ALTER TABLE "DeviceToken" DROP COLUMN "token",
ADD COLUMN     "fcmToken" TEXT NOT NULL,
ALTER COLUMN "appVersion" DROP NOT NULL,
ALTER COLUMN "dateTime" DROP NOT NULL,
ALTER COLUMN "platform" DROP NOT NULL,
ALTER COLUMN "platformVersion" DROP NOT NULL;

-- DropTable
DROP TABLE "UserSession";

-- CreateIndex
CREATE UNIQUE INDEX "DeviceToken_fcmToken_key" ON "DeviceToken"("fcmToken");
