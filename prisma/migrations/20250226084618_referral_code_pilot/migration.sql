/*
  Warnings:

  - A unique constraint covering the columns `[referralCode]` on the table `Pilot` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `referralCode` to the `Pilot` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Pilot" ADD COLUMN     "referralCode" TEXT NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Pilot_referralCode_key" ON "Pilot"("referralCode");
