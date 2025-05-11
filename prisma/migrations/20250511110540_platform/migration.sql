/*
  Warnings:

  - You are about to drop the column `appVersion` on the `DeviceToken` table. All the data in the column will be lost.

*/
-- CreateEnum
CREATE TYPE "AppPlatform" AS ENUM ('ANDROID_DRIVER', 'ANDROID_CUSTOMER', 'IOS_CUSTOMER');

-- AlterTable
ALTER TABLE "DeviceToken" DROP COLUMN "appVersion";

-- CreateTable
CREATE TABLE "Platform" (
    "id" TEXT NOT NULL,
    "appVersion" TEXT,
    "appDescription" "AppPlatform" NOT NULL,

    CONSTRAINT "Platform_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Platform_appDescription_key" ON "Platform"("appDescription");
