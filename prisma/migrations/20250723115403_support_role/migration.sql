-- AlterTable
ALTER TABLE "Support" ADD COLUMN     "email" TEXT,
ADD COLUMN     "supportRoleId" TEXT;

-- CreateTable
CREATE TABLE "SupportRole" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "SupportRole_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SupportRole_name_key" ON "SupportRole"("name");

-- AddForeignKey
ALTER TABLE "Support" ADD CONSTRAINT "Support_supportRoleId_fkey" FOREIGN KEY ("supportRoleId") REFERENCES "SupportRole"("id") ON DELETE SET NULL ON UPDATE CASCADE;
