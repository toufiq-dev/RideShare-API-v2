/*
  Warnings:

  - You are about to drop the column `password` on the `Support` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[referralCode]` on the table `Support` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `name` to the `Support` table without a default value. This is not possible if the table is not empty.
  - Added the required column `phone` to the `Support` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Support" DROP COLUMN "password",
ADD COLUMN     "name" TEXT NOT NULL,
ADD COLUMN     "phone" TEXT NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Support_referralCode_key" ON "Support"("referralCode");
