/*
  Warnings:

  - You are about to drop the column `fare` on the `Booking` table. All the data in the column will be lost.
  - Added the required column `discountedFare` to the `Booking` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Booking" DROP COLUMN "fare",
ADD COLUMN     "discountedFare" DECIMAL(10,2) NOT NULL,
ADD COLUMN     "tripEndFare" DECIMAL(10,2);

-- AlterTable
ALTER TABLE "Pilot" ALTER COLUMN "averageRating" SET DEFAULT 5.0;
