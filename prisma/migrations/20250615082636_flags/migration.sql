-- AlterTable
ALTER TABLE "Pilot" ADD COLUMN     "isNidVerified" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "isNumberPlateVerified" BOOLEAN NOT NULL DEFAULT false;
