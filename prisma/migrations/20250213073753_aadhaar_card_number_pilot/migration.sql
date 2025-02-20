/*
  Warnings:

  - A unique constraint covering the columns `[aadhaarCardNumber]` on the table `Pilot` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "Pilot" ADD COLUMN     "aadhaarCardNumber" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Pilot_aadhaarCardNumber_key" ON "Pilot"("aadhaarCardNumber");
