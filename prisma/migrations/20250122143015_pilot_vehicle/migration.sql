/*
  Warnings:

  - You are about to drop the column `panCardName` on the `Pilot` table. All the data in the column will be lost.
  - You are about to drop the column `panCardNumber` on the `Pilot` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Pilot" DROP COLUMN "panCardName",
DROP COLUMN "panCardNumber";

-- AlterTable
ALTER TABLE "Vehicle" ALTER COLUMN "capacity" DROP NOT NULL;
