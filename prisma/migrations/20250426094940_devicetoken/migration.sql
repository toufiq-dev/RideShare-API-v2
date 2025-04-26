/*
  Warnings:

  - The primary key for the `DeviceToken` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `id` on the `DeviceToken` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[userId]` on the table `DeviceToken` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "Booking_status_createdAt_idx";

-- AlterTable
ALTER TABLE "DeviceToken" DROP CONSTRAINT "DeviceToken_pkey",
DROP COLUMN "id",
ADD CONSTRAINT "DeviceToken_pkey" PRIMARY KEY ("userId");

-- CreateIndex
CREATE INDEX "Booking_status_idx" ON "Booking"("status");

-- CreateIndex
CREATE UNIQUE INDEX "DeviceToken_userId_key" ON "DeviceToken"("userId");

-- CreateIndex
CREATE INDEX "DeviceToken_fcmToken_idx" ON "DeviceToken"("fcmToken");

-- CreateIndex
CREATE INDEX "VehicleType_name_idx" ON "VehicleType"("name");
