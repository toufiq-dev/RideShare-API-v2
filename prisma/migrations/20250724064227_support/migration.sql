/*
  Warnings:

  - A unique constraint covering the columns `[email]` on the table `Support` will be added. If there are existing duplicate values, this will fail.
  - Made the column `email` on table `Support` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "Support" ALTER COLUMN "email" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Support_email_key" ON "Support"("email");
