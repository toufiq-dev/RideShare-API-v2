/*
  Warnings:

  - You are about to drop the column `cancellationReason` on the `Booking` table. All the data in the column will be lost.
  - You are about to drop the column `deviceType` on the `DeviceToken` table. All the data in the column will be lost.
  - You are about to drop the column `isDocumentVerified` on the `Pilot` table. All the data in the column will be lost.
  - You are about to drop the column `licenseNumber` on the `Pilot` table. All the data in the column will be lost.
  - You are about to drop the column `pilotProgram` on the `Pilot` table. All the data in the column will be lost.
  - You are about to drop the column `vehicleId` on the `Pilot` table. All the data in the column will be lost.
  - You are about to drop the column `name` on the `PilotSubscription` table. All the data in the column will be lost.
  - You are about to drop the column `type` on the `SavedPlace` table. All the data in the column will be lost.
  - You are about to drop the column `phone` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `fitnessExpiry` on the `Vehicle` table. All the data in the column will be lost.
  - You are about to drop the column `licensePlate` on the `Vehicle` table. All the data in the column will be lost.
  - You are about to drop the column `make` on the `Vehicle` table. All the data in the column will be lost.
  - You are about to drop the column `puccExpiry` on the `Vehicle` table. All the data in the column will be lost.
  - You are about to drop the column `vehicleType` on the `Vehicle` table. All the data in the column will be lost.
  - You are about to drop the `CustomerLanguage` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `LegalDocument` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `PilotLanguage` table. If the table is not empty, all the data it contains will be lost.
  - A unique constraint covering the columns `[phone]` on the table `Customer` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[phone]` on the table `Pilot` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[drivingLicense]` on the table `Pilot` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[subscriptionTypeId]` on the table `PilotSubscription` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[rcNumber]` on the table `Vehicle` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `languageId` to the `Customer` table without a default value. This is not possible if the table is not empty.
  - Added the required column `phone` to the `Customer` table without a default value. This is not possible if the table is not empty.
  - Added the required column `appVersion` to the `DeviceToken` table without a default value. This is not possible if the table is not empty.
  - Added the required column `dateTime` to the `DeviceToken` table without a default value. This is not possible if the table is not empty.
  - Added the required column `platform` to the `DeviceToken` table without a default value. This is not possible if the table is not empty.
  - Added the required column `platformVersion` to the `DeviceToken` table without a default value. This is not possible if the table is not empty.
  - Added the required column `languageId` to the `Pilot` table without a default value. This is not possible if the table is not empty.
  - Added the required column `phone` to the `Pilot` table without a default value. This is not possible if the table is not empty.
  - Added the required column `lastUpdated` to the `PilotEarning` table without a default value. This is not possible if the table is not empty.
  - Added the required column `subscriptionTypeId` to the `PilotSubscription` table without a default value. This is not possible if the table is not empty.
  - Added the required column `authTokenVersion` to the `User` table without a default value. This is not possible if the table is not empty.
  - Added the required column `pilotId` to the `Vehicle` table without a default value. This is not possible if the table is not empty.
  - Added the required column `rcNumber` to the `Vehicle` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "CustomerLanguage" DROP CONSTRAINT "CustomerLanguage_customerId_fkey";

-- DropForeignKey
ALTER TABLE "CustomerLanguage" DROP CONSTRAINT "CustomerLanguage_languageId_fkey";

-- DropForeignKey
ALTER TABLE "Pilot" DROP CONSTRAINT "Pilot_vehicleId_fkey";

-- DropForeignKey
ALTER TABLE "PilotLanguage" DROP CONSTRAINT "PilotLanguage_languageId_fkey";

-- DropForeignKey
ALTER TABLE "PilotLanguage" DROP CONSTRAINT "PilotLanguage_pilotId_fkey";

-- DropIndex
DROP INDEX "Customer_userId_idx";

-- DropIndex
DROP INDEX "DeviceToken_userId_idx";

-- DropIndex
DROP INDEX "Pilot_licenseNumber_idx";

-- DropIndex
DROP INDEX "Pilot_licenseNumber_key";

-- DropIndex
DROP INDEX "Pilot_vehicleId_idx";

-- DropIndex
DROP INDEX "SavedPlace_customerId_type_key";

-- DropIndex
DROP INDEX "User_phone_idx";

-- DropIndex
DROP INDEX "User_phone_key";

-- DropIndex
DROP INDEX "UserSession_userId_idx";

-- DropIndex
DROP INDEX "Vehicle_licensePlate_key";

-- AlterTable
ALTER TABLE "Booking" DROP COLUMN "cancellationReason",
ADD COLUMN     "cancellationReasonId" TEXT;

-- AlterTable
ALTER TABLE "Customer" ADD COLUMN     "languageId" TEXT NOT NULL,
ADD COLUMN     "phone" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "DeviceToken" DROP COLUMN "deviceType",
ADD COLUMN     "appVersion" TEXT NOT NULL,
ADD COLUMN     "dateTime" TEXT NOT NULL,
ADD COLUMN     "platform" TEXT NOT NULL,
ADD COLUMN     "platformVersion" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "Pilot" DROP COLUMN "isDocumentVerified",
DROP COLUMN "licenseNumber",
DROP COLUMN "pilotProgram",
DROP COLUMN "vehicleId",
ADD COLUMN     "dateOfBirth" TIMESTAMP(3),
ADD COLUMN     "drivingLicense" TEXT,
ADD COLUMN     "languageId" TEXT NOT NULL,
ADD COLUMN     "panCardName" TEXT,
ADD COLUMN     "panCardNumber" TEXT,
ADD COLUMN     "phone" TEXT NOT NULL,
ADD COLUMN     "pilotProgramId" TEXT,
ADD COLUMN     "providedDrivingLicense" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "providedPanCard" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "providedRC" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "selfieUrl" TEXT;

-- AlterTable
ALTER TABLE "PilotEarning" ADD COLUMN     "lastUpdated" TIMESTAMP(3) NOT NULL;

-- AlterTable
ALTER TABLE "PilotSubscription" DROP COLUMN "name",
ADD COLUMN     "subscriptionTypeId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "SavedPlace" DROP COLUMN "type",
ALTER COLUMN "name" DROP NOT NULL,
ALTER COLUMN "location" DROP NOT NULL;

-- AlterTable
ALTER TABLE "User" DROP COLUMN "phone",
ADD COLUMN     "authTokenVersion" INTEGER NOT NULL,
ALTER COLUMN "email" DROP NOT NULL,
ALTER COLUMN "isEmailVerified" DROP NOT NULL,
ALTER COLUMN "name" DROP NOT NULL,
ALTER COLUMN "avatar" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Vehicle" DROP COLUMN "fitnessExpiry",
DROP COLUMN "licensePlate",
DROP COLUMN "make",
DROP COLUMN "puccExpiry",
DROP COLUMN "vehicleType",
ADD COLUMN     "manufacturer" TEXT,
ADD COLUMN     "permitExpiry" TIMESTAMP(3),
ADD COLUMN     "pilotId" TEXT NOT NULL,
ADD COLUMN     "rcNumber" TEXT NOT NULL,
ADD COLUMN     "registrationExpiry" TIMESTAMP(3),
ADD COLUMN     "vehicleTypeId" TEXT,
ALTER COLUMN "model" DROP NOT NULL,
ALTER COLUMN "year" DROP NOT NULL,
ALTER COLUMN "insuranceExpiry" DROP NOT NULL;

-- DropTable
DROP TABLE "CustomerLanguage";

-- DropTable
DROP TABLE "LegalDocument";

-- DropTable
DROP TABLE "PilotLanguage";

-- DropEnum
DROP TYPE "DeviceType";

-- DropEnum
DROP TYPE "LegalDocType";

-- DropEnum
DROP TYPE "PilotProgram";

-- DropEnum
DROP TYPE "SubscriptionType";

-- DropEnum
DROP TYPE "VehicleType";

-- CreateTable
CREATE TABLE "PilotProgram" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,

    CONSTRAINT "PilotProgram_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VehicleType" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "VehicleType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SubscriptionType" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "SubscriptionType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CancellationReason" (
    "id" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,

    CONSTRAINT "CancellationReason_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PilotProgram_name_key" ON "PilotProgram"("name");

-- CreateIndex
CREATE UNIQUE INDEX "VehicleType_name_key" ON "VehicleType"("name");

-- CreateIndex
CREATE UNIQUE INDEX "SubscriptionType_name_key" ON "SubscriptionType"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Customer_phone_key" ON "Customer"("phone");

-- CreateIndex
CREATE INDEX "Customer_phone_idx" ON "Customer"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "Pilot_phone_key" ON "Pilot"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "Pilot_drivingLicense_key" ON "Pilot"("drivingLicense");

-- CreateIndex
CREATE INDEX "Pilot_isAvailable_currentLocation_idx" ON "Pilot"("isAvailable", "currentLocation");

-- CreateIndex
CREATE UNIQUE INDEX "PilotSubscription_subscriptionTypeId_key" ON "PilotSubscription"("subscriptionTypeId");

-- CreateIndex
CREATE UNIQUE INDEX "Vehicle_rcNumber_key" ON "Vehicle"("rcNumber");

-- AddForeignKey
ALTER TABLE "Customer" ADD CONSTRAINT "Customer_languageId_fkey" FOREIGN KEY ("languageId") REFERENCES "Languages"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Pilot" ADD CONSTRAINT "Pilot_languageId_fkey" FOREIGN KEY ("languageId") REFERENCES "Languages"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Pilot" ADD CONSTRAINT "Pilot_pilotProgramId_fkey" FOREIGN KEY ("pilotProgramId") REFERENCES "PilotProgram"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Vehicle" ADD CONSTRAINT "Vehicle_pilotId_fkey" FOREIGN KEY ("pilotId") REFERENCES "Pilot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Vehicle" ADD CONSTRAINT "Vehicle_vehicleTypeId_fkey" FOREIGN KEY ("vehicleTypeId") REFERENCES "VehicleType"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PilotSubscription" ADD CONSTRAINT "PilotSubscription_subscriptionTypeId_fkey" FOREIGN KEY ("subscriptionTypeId") REFERENCES "SubscriptionType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_cancellationReasonId_fkey" FOREIGN KEY ("cancellationReasonId") REFERENCES "CancellationReason"("id") ON DELETE SET NULL ON UPDATE CASCADE;
