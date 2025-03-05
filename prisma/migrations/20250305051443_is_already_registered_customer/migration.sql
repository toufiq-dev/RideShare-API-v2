-- AlterTable
ALTER TABLE "Customer" ADD COLUMN     "isAlreadyRegistered" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Pilot" ADD COLUMN     "isAlreadyRegistered" BOOLEAN NOT NULL DEFAULT false;
