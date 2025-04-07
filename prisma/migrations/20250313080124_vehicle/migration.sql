/*
  Warnings:

  - A unique constraint covering the columns `[referralCode]` on the table `Pilot` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "Vehicle" ALTER COLUMN "fitUpto" DROP NOT NULL,
ALTER COLUMN "insuranceUpto" DROP NOT NULL,
ALTER COLUMN "puccUpto" DROP NOT NULL,
ALTER COLUMN "regUpto" DROP NOT NULL,
ALTER COLUMN "permitUpto" DROP NOT NULL,
ALTER COLUMN "permitUpto" SET DATA TYPE TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Pilot_referralCode_key" ON "Pilot"("referralCode");
