/*
  Warnings:

  - A unique constraint covering the columns `[panCardNumber]` on the table `Pilot` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "Pilot_panCardNumber_key" ON "Pilot"("panCardNumber");
