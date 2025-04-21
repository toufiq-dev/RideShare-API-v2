/*
  Warnings:

  - Changed the type of `estimatedDuration` on the `Booking` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- AlterTable
ALTER TABLE "Booking" DROP COLUMN "estimatedDuration",
ADD COLUMN     "estimatedDuration" INTEGER NOT NULL;
