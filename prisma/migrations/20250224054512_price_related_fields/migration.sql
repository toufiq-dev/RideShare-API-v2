/*
  Warnings:

  - You are about to alter the column `amount` on the `PilotEarning` table. The data in that column could be lost. The data in that column will be cast from `Decimal(65,30)` to `Decimal(10,2)`.
  - You are about to alter the column `balance` on the `PilotWallet` table. The data in that column could be lost. The data in that column will be cast from `Integer` to `Decimal(10,2)`.
  - You are about to alter the column `minusLimit` on the `PilotWallet` table. The data in that column could be lost. The data in that column will be cast from `Integer` to `Decimal(10,2)`.
  - You are about to alter the column `amount` on the `SubscriptionTransaction` table. The data in that column could be lost. The data in that column will be cast from `Decimal(65,30)` to `Decimal(10,2)`.
  - You are about to alter the column `amount` on the `Transaction` table. The data in that column could be lost. The data in that column will be cast from `Decimal(65,30)` to `Decimal(10,2)`.
  - Added the required column `price` to the `PilotSubscription` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "PilotEarning" ALTER COLUMN "amount" SET DATA TYPE DECIMAL(10,2);

-- AlterTable
ALTER TABLE "PilotSubscription" ADD COLUMN     "price" DECIMAL(10,2) NOT NULL,
ADD COLUMN     "priceBeforeDiscount" DECIMAL(10,2);

-- AlterTable
ALTER TABLE "PilotWallet" ALTER COLUMN "balance" SET DATA TYPE DECIMAL(10,2),
ALTER COLUMN "minusLimit" SET DEFAULT -100.00,
ALTER COLUMN "minusLimit" SET DATA TYPE DECIMAL(10,2);

-- AlterTable
ALTER TABLE "SubscriptionTransaction" ALTER COLUMN "amount" SET DATA TYPE DECIMAL(10,2);

-- AlterTable
ALTER TABLE "Transaction" ALTER COLUMN "amount" SET DATA TYPE DECIMAL(10,2);
