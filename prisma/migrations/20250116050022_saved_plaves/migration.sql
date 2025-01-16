/*
  Warnings:

  - You are about to drop the column `deviceType` on the `DeviceToken` table. All the data in the column will be lost.
  - You are about to drop the column `type` on the `SavedPlace` table. All the data in the column will be lost.
  - Added the required column `appVersion` to the `DeviceToken` table without a default value. This is not possible if the table is not empty.
  - Added the required column `dateTime` to the `DeviceToken` table without a default value. This is not possible if the table is not empty.
  - Added the required column `platform` to the `DeviceToken` table without a default value. This is not possible if the table is not empty.
  - Added the required column `platformVersion` to the `DeviceToken` table without a default value. This is not possible if the table is not empty.
  - Added the required column `authTokenVersion` to the `User` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "SavedPlace_customerId_type_key";

-- AlterTable
ALTER TABLE "DeviceToken" DROP COLUMN "deviceType",
ADD COLUMN     "appVersion" TEXT NOT NULL,
ADD COLUMN     "dateTime" TEXT NOT NULL,
ADD COLUMN     "platform" TEXT NOT NULL,
ADD COLUMN     "platformVersion" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "SavedPlace" DROP COLUMN "type",
ALTER COLUMN "name" DROP NOT NULL,
ALTER COLUMN "location" DROP NOT NULL;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "authTokenVersion" INTEGER NOT NULL;

-- DropEnum
DROP TYPE "DeviceType";
