/*
  Warnings:

  - The `isDLVerified` column on the `Pilot` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `isRCVerified` column on the `Pilot` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `isPanCardVerified` column on the `Pilot` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `isAadhaarVerified` column on the `Pilot` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `isNidVerified` column on the `Pilot` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `isNumberPlateVerified` column on the `Pilot` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- CreateEnum
CREATE TYPE "VerificationStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'APPROVED', 'REJECTED');

-- AlterTable
ALTER TABLE "Pilot" ADD COLUMN     "numberPlateUrl" TEXT,
DROP COLUMN "isDLVerified",
ADD COLUMN     "isDLVerified" "VerificationStatus" NOT NULL DEFAULT 'PENDING',
DROP COLUMN "isRCVerified",
ADD COLUMN     "isRCVerified" "VerificationStatus" NOT NULL DEFAULT 'PENDING',
DROP COLUMN "isPanCardVerified",
ADD COLUMN     "isPanCardVerified" "VerificationStatus" NOT NULL DEFAULT 'PENDING',
DROP COLUMN "isAadhaarVerified",
ADD COLUMN     "isAadhaarVerified" "VerificationStatus" NOT NULL DEFAULT 'PENDING',
DROP COLUMN "isNidVerified",
ADD COLUMN     "isNidVerified" "VerificationStatus" NOT NULL DEFAULT 'PENDING',
DROP COLUMN "isNumberPlateVerified",
ADD COLUMN     "isNumberPlateVerified" "VerificationStatus" NOT NULL DEFAULT 'PENDING';
