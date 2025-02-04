/*
  Warnings:

  - You are about to drop the column `hasAcceptedTerms` on the `Pilot` table. All the data in the column will be lost.
  - You are about to drop the column `providedDrivingLicense` on the `Pilot` table. All the data in the column will be lost.
  - You are about to drop the column `providedPanCard` on the `Pilot` table. All the data in the column will be lost.
  - You are about to drop the column `providedRC` on the `Pilot` table. All the data in the column will be lost.
  - You are about to drop the column `subscriptionId` on the `Pilot` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "Pilot" DROP CONSTRAINT "Pilot_subscriptionId_fkey";

-- AlterTable
ALTER TABLE "Pilot" DROP COLUMN "hasAcceptedTerms",
DROP COLUMN "providedDrivingLicense",
DROP COLUMN "providedPanCard",
DROP COLUMN "providedRC",
DROP COLUMN "subscriptionId",
ADD COLUMN     "acceptedTerms" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "isDLVerified" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "isPanCardVerified" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "isRCVerified" BOOLEAN NOT NULL DEFAULT false;
