/*
  Warnings:

  - The values [SUCCESSFULL] on the enum `TransactionStatus` will be removed. If these variants are still used in the database, this will fail.
  - You are about to drop the column `discount` on the `Booking` table. All the data in the column will be lost.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "TransactionStatus_new" AS ENUM ('PENDING', 'SUCCESSFUL', 'FAILED');
ALTER TABLE "Transaction" ALTER COLUMN "status" TYPE "TransactionStatus_new" USING ("status"::text::"TransactionStatus_new");
ALTER TYPE "TransactionStatus" RENAME TO "TransactionStatus_old";
ALTER TYPE "TransactionStatus_new" RENAME TO "TransactionStatus";
DROP TYPE "TransactionStatus_old";
COMMIT;

-- AlterTable
ALTER TABLE "Booking" DROP COLUMN "discount";
