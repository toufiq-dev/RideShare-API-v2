/*
  Warnings:

  - A unique constraint covering the columns `[pilotId]` on the table `Vehicle` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "Vehicle_pilotId_key" ON "Vehicle"("pilotId");
