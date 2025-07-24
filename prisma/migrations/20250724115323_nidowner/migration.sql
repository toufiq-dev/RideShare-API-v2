/*
  Warnings:

  - A unique constraint covering the columns `[vehicleOwnerNidNumber]` on the table `Nid` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "Nid" ADD COLUMN     "vehicleOwnerNidDateOfBirth" TIMESTAMP(3),
ADD COLUMN     "vehicleOwnerNidName" TEXT,
ADD COLUMN     "vehicleOwnerNidNumber" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Nid_vehicleOwnerNidNumber_key" ON "Nid"("vehicleOwnerNidNumber");
