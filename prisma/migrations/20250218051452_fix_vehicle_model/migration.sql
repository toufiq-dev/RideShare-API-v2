/*
  Warnings:

  - Added the required column `permitUpto` to the `Vehicle` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Vehicle" ADD COLUMN     "permitUpto" TIMESTAMP(3) NOT NULL;
