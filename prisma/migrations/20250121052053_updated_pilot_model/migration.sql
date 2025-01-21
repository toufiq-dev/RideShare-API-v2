/*
  Warnings:

  - You are about to drop the column `drivingLicense` on the `Pilot` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[drivingLicenseNumber]` on the table `Pilot` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "Pilot_drivingLicense_key";

-- AlterTable
ALTER TABLE "Pilot" DROP COLUMN "drivingLicense",
ADD COLUMN     "drivingLicenseName" TEXT,
ADD COLUMN     "drivingLicenseNumber" TEXT,
ADD COLUMN     "issueDate" TEXT,
ADD COLUMN     "validTill" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Pilot_drivingLicenseNumber_key" ON "Pilot"("drivingLicenseNumber");
