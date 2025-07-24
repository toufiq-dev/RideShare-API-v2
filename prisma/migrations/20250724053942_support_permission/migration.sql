/*
  Warnings:

  - You are about to drop the column `supportId` on the `SupportPermission` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[supportRoleId,menuKey]` on the table `SupportPermission` will be added. If there are existing duplicate values, this will fail.
  - Made the column `supportRoleId` on table `SupportPermission` required. This step will fail if there are existing NULL values in that column.

*/
-- DropForeignKey
ALTER TABLE "SupportPermission" DROP CONSTRAINT "SupportPermission_supportId_fkey";

-- DropForeignKey
ALTER TABLE "SupportPermission" DROP CONSTRAINT "SupportPermission_supportRoleId_fkey";

-- DropIndex
DROP INDEX "SupportPermission_supportId_menuKey_key";

-- AlterTable
ALTER TABLE "SupportPermission" DROP COLUMN "supportId",
ALTER COLUMN "supportRoleId" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "SupportPermission_supportRoleId_menuKey_key" ON "SupportPermission"("supportRoleId", "menuKey");

-- AddForeignKey
ALTER TABLE "SupportPermission" ADD CONSTRAINT "SupportPermission_supportRoleId_fkey" FOREIGN KEY ("supportRoleId") REFERENCES "SupportRole"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
