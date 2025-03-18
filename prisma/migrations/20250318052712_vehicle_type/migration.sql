/*
  Warnings:

  - You are about to drop the column `description` on the `VehicleType` table. All the data in the column will be lost.
  - Added the required column `updatedAt` to the `Transaction` table without a default value. This is not possible if the table is not empty.
  - Added the required column `isFaster` to the `VehicleType` table without a default value. This is not possible if the table is not empty.
  - Added the required column `passengerCapacity` to the `VehicleType` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Transaction" ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- AlterTable
ALTER TABLE "VehicleType" DROP COLUMN "description",
ADD COLUMN     "airCondition" TEXT[],
ADD COLUMN     "isFaster" BOOLEAN NOT NULL,
ADD COLUMN     "passengerCapacity" INTEGER NOT NULL;
