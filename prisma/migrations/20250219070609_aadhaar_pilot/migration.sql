-- AlterTable
ALTER TABLE "Pilot" ADD COLUMN     "aadhaarName" TEXT,
ADD COLUMN     "isAadhaarVerified" BOOLEAN NOT NULL DEFAULT false;
