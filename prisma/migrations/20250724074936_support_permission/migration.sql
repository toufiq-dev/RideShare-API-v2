/*
  Warnings:

  - A unique constraint covering the columns `[menuKey]` on the table `SupportPermission` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "SupportPermission_menuKey_key" ON "SupportPermission"("menuKey");
