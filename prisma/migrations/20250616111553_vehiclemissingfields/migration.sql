-- AlterTable
ALTER TABLE "Vehicle" ADD COLUMN     "expiryDate" TIMESTAMP(3),
ADD COLUMN     "registrationDate" TIMESTAMP(3),
ALTER COLUMN "status" DROP NOT NULL;
