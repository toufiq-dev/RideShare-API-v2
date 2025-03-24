/*
  Warnings:

  - Added the required column `estimatedDistance` to the `Booking` table without a default value. This is not possible if the table is not empty.
  - Made the column `estimatedDuration` on table `Booking` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "Booking" ADD COLUMN     "estimatedDistance" TEXT NOT NULL,
ALTER COLUMN "duration" SET DATA TYPE TEXT,
ALTER COLUMN "distance" DROP NOT NULL,
ALTER COLUMN "estimatedDuration" SET NOT NULL,
ALTER COLUMN "estimatedDuration" SET DATA TYPE TEXT;
