-- AlterTable
ALTER TABLE "SupportPermission" ADD COLUMN     "supportRoleId" TEXT;

-- AlterTable
ALTER TABLE "SupportRole" ADD COLUMN     "description" TEXT;

-- AddForeignKey
ALTER TABLE "SupportPermission" ADD CONSTRAINT "SupportPermission_supportRoleId_fkey" FOREIGN KEY ("supportRoleId") REFERENCES "SupportRole"("id") ON DELETE SET NULL ON UPDATE CASCADE;
