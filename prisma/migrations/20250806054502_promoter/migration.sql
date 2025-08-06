-- AlterEnum
ALTER TYPE "public"."UserRole" ADD VALUE 'PROMOTER';

-- AlterTable
ALTER TABLE "public"."Pilot" ADD COLUMN     "promoterId" TEXT;

-- CreateTable
CREATE TABLE "public"."Promoter" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT,
    "bloodGroup" TEXT,
    "selfieUrl" TEXT,
    "idPhotoUrl" TEXT,
    "nidPhotoUrl" TEXT,
    "referralCode" TEXT NOT NULL,
    "isApproved" BOOLEAN NOT NULL DEFAULT false,
    "totalDriversOnboarded" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "Promoter_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Promoter_userId_key" ON "public"."Promoter"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Promoter_phone_key" ON "public"."Promoter"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "Promoter_referralCode_key" ON "public"."Promoter"("referralCode");

-- AddForeignKey
ALTER TABLE "public"."Promoter" ADD CONSTRAINT "Promoter_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Pilot" ADD CONSTRAINT "Pilot_promoterId_fkey" FOREIGN KEY ("promoterId") REFERENCES "public"."Promoter"("id") ON DELETE SET NULL ON UPDATE CASCADE;
