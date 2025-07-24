/*
  Warnings:

  - Added the required column `password` to the `Support` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Support" ADD COLUMN     "password" TEXT NOT NULL;
