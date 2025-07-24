/*
  Warnings:

  - You are about to drop the column `supportRoleId` on the `SupportPermission` table. All the data in the column will be lost.
  - Made the column `supportRoleId` on table `Support` required. This step will fail if there are existing NULL values in that column.

*/
-- DropForeignKey
ALTER TABLE "Support" DROP CONSTRAINT "Support_supportRoleId_fkey";

-- DropForeignKey
ALTER TABLE "SupportPermission" DROP CONSTRAINT "SupportPermission_supportRoleId_fkey";

-- DropIndex
DROP INDEX "SupportPermission_supportRoleId_menuKey_key";

-- AlterTable
ALTER TABLE "Support" ALTER COLUMN "supportRoleId" SET NOT NULL;

-- AlterTable
ALTER TABLE "SupportPermission" DROP COLUMN "supportRoleId";

-- CreateTable
CREATE TABLE "_SupportPermissionToSupportRole" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_SupportPermissionToSupportRole_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE INDEX "_SupportPermissionToSupportRole_B_index" ON "_SupportPermissionToSupportRole"("B");

-- AddForeignKey
ALTER TABLE "Support" ADD CONSTRAINT "Support_supportRoleId_fkey" FOREIGN KEY ("supportRoleId") REFERENCES "SupportRole"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_SupportPermissionToSupportRole" ADD CONSTRAINT "_SupportPermissionToSupportRole_A_fkey" FOREIGN KEY ("A") REFERENCES "SupportPermission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_SupportPermissionToSupportRole" ADD CONSTRAINT "_SupportPermissionToSupportRole_B_fkey" FOREIGN KEY ("B") REFERENCES "SupportRole"("id") ON DELETE CASCADE ON UPDATE CASCADE;
