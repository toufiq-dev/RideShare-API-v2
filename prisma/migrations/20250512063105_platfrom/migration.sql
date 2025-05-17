/*
  Warnings:

  - You are about to drop the column `appVersion` on the `Platform` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Platform" DROP COLUMN "appVersion",
ADD COLUMN     "adCustomerVersion" INTEGER,
ADD COLUMN     "adDriverVersion" INTEGER,
ADD COLUMN     "iosCustomerVersion" TEXT;
