-- AlterEnum
ALTER TYPE "TransactionType" ADD VALUE 'AUTO_RECHARGE';

-- AlterTable
ALTER TABLE "PilotWallet" ADD COLUMN     "autoRechargeAmount" DECIMAL(10,2) DEFAULT 0.00,
ADD COLUMN     "autoRechargeDate" TIMESTAMPTZ,
ADD COLUMN     "autoRechargeEnabled" BOOLEAN DEFAULT false,
ADD COLUMN     "autoRechargeEnabledUntil" TIMESTAMPTZ;
