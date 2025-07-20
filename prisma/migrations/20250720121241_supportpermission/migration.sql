-- AlterTable
ALTER TABLE "Support" ADD COLUMN     "phone" TEXT,
ALTER COLUMN "referralCode" DROP NOT NULL;

-- CreateTable
CREATE TABLE "SupportPermission" (
    "id" TEXT NOT NULL,
    "supportId" TEXT NOT NULL,
    "menuKey" TEXT NOT NULL,
    "isVisible" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SupportPermission_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SupportPermission_supportId_menuKey_key" ON "SupportPermission"("supportId", "menuKey");

-- AddForeignKey
ALTER TABLE "SupportPermission" ADD CONSTRAINT "SupportPermission_supportId_fkey" FOREIGN KEY ("supportId") REFERENCES "Support"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
