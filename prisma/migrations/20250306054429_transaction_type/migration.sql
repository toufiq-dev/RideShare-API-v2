/*
  Warnings:

  - The values [CUSTOMER_PAYMENT,CUSTOMER_REFUND] on the enum `TransactionType` will be removed. If these variants are still used in the database, this will fail.
  - You are about to alter the column `coins` on the `PilotSubscription` table. The data in that column could be lost. The data in that column will be cast from `Integer` to `Decimal(10,2)`.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "TransactionType_new" AS ENUM ('SUBSCRIPTION_PURCHASE', 'TRIP_DEDUCTION', 'REFUND', 'BONUS', 'ONBOARDING_OFFER');
ALTER TABLE "Transaction" ALTER COLUMN "type" TYPE "TransactionType_new" USING ("type"::text::"TransactionType_new");
ALTER TYPE "TransactionType" RENAME TO "TransactionType_old";
ALTER TYPE "TransactionType_new" RENAME TO "TransactionType";
DROP TYPE "TransactionType_old";
COMMIT;

-- AlterTable
ALTER TABLE "PilotSubscription" ALTER COLUMN "coins" SET DATA TYPE DECIMAL(10,2);
