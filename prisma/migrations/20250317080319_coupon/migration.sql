-- DropIndex
DROP INDEX "DeviceToken_fcmToken_key";

-- AlterTable
ALTER TABLE "Customer" ADD COLUMN     "couponId" TEXT;

-- CreateTable
CREATE TABLE "Coupon" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "discount" DECIMAL(10,2) NOT NULL,
    "validUntil" TIMESTAMP(3),

    CONSTRAINT "Coupon_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Coupon_name_key" ON "Coupon"("name");

-- AddForeignKey
ALTER TABLE "Customer" ADD CONSTRAINT "Customer_couponId_fkey" FOREIGN KEY ("couponId") REFERENCES "Coupon"("id") ON DELETE SET NULL ON UPDATE CASCADE;
