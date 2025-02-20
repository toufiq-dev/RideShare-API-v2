/*
  Warnings:

  - You are about to drop the column `makerModel` on the `Vehicle` table. All the data in the column will be lost.
  - You are about to drop the column `permitUpto` on the `Vehicle` table. All the data in the column will be lost.
  - You are about to drop the column `vehicleColour` on the `Vehicle` table. All the data in the column will be lost.
  - You are about to drop the column `vehicleSeatingCapacity` on the `Vehicle` table. All the data in the column will be lost.
  - You are about to drop the column `vehicleState` on the `Vehicle` table. All the data in the column will be lost.
  - Added the required column `colour` to the `Vehicle` table without a default value. This is not possible if the table is not empty.
  - Added the required column `model` to the `Vehicle` table without a default value. This is not possible if the table is not empty.
  - Added the required column `state` to the `Vehicle` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Vehicle" DROP COLUMN "makerModel",
DROP COLUMN "permitUpto",
DROP COLUMN "vehicleColour",
DROP COLUMN "vehicleSeatingCapacity",
DROP COLUMN "vehicleState",
ADD COLUMN     "colour" TEXT NOT NULL,
ADD COLUMN     "model" TEXT NOT NULL,
ADD COLUMN     "state" TEXT NOT NULL;
