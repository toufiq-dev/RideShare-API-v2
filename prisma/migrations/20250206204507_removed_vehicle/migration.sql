/*
  Warnings:

  - You are about to drop the column `registrationExpiry` on the `Vehicle` table. All the data in the column will be lost.
  - The `permitUpto` column on the `Vehicle` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - Changed the type of `regUpto` on the `Vehicle` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- AlterTable
ALTER TABLE "Vehicle" DROP COLUMN "registrationExpiry",
DROP COLUMN "permitUpto",
ADD COLUMN     "permitUpto" TIMESTAMP(3),
DROP COLUMN "regUpto",
ADD COLUMN     "regUpto" TIMESTAMP(3) NOT NULL;
