-- AlterTable
ALTER TABLE "Pilot" ADD COLUMN     "pilotCouponId" TEXT;

-- CreateTable
CREATE TABLE "PilotCoupon" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "discount" DECIMAL(10,2) NOT NULL,
    "validUntil" TIMESTAMPTZ,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PilotCoupon_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PilotCoupon_name_key" ON "PilotCoupon"("name");

-- AddForeignKey
ALTER TABLE "Pilot" ADD CONSTRAINT "Pilot_pilotCouponId_fkey" FOREIGN KEY ("pilotCouponId") REFERENCES "PilotCoupon"("id") ON DELETE SET NULL ON UPDATE CASCADE;
