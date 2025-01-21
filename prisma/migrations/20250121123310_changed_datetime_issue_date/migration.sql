/*
  Warnings:

  - The `issueDate` column on the `Pilot` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `validTill` column on the `Pilot` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- AlterTable
ALTER TABLE "Pilot" DROP COLUMN "issueDate",
ADD COLUMN     "issueDate" TIMESTAMP(3),
DROP COLUMN "validTill",
ADD COLUMN     "validTill" TIMESTAMP(3);
