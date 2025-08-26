/*
  Warnings:

  - Made the column `bookingId` on table `SupportTicket` required. This step will fail if there are existing NULL values in that column.

*/
-- DropForeignKey
ALTER TABLE "public"."SupportTicket" DROP CONSTRAINT "SupportTicket_bookingId_fkey";

-- DropIndex
DROP INDEX "public"."SupportTicket_bookingId_key";

-- AlterTable
ALTER TABLE "public"."Coupon" ALTER COLUMN "discount" SET DEFAULT 0.00;

-- AlterTable
ALTER TABLE "public"."PilotCoupon" ADD COLUMN     "discount" DECIMAL(10,2) NOT NULL DEFAULT 0.00;

-- AlterTable
ALTER TABLE "public"."SupportTicket" ADD COLUMN     "assignedAt" TIMESTAMPTZ,
ADD COLUMN     "evidenceUrl" TEXT[],
ADD COLUMN     "notes" JSONB,
ADD COLUMN     "resolvedAt" TIMESTAMPTZ,
ADD COLUMN     "supportId" TEXT,
ADD COLUMN     "whatsAppPhone" TEXT,
ALTER COLUMN "bookingId" SET NOT NULL,
ALTER COLUMN "channel" SET DEFAULT 'CHAT';

-- AddForeignKey
ALTER TABLE "public"."SupportTicket" ADD CONSTRAINT "SupportTicket_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "public"."Booking"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."SupportTicket" ADD CONSTRAINT "SupportTicket_supportId_fkey" FOREIGN KEY ("supportId") REFERENCES "public"."Support"("id") ON DELETE SET NULL ON UPDATE CASCADE;
