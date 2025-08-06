/*
  Warnings:

  - You are about to drop the column `selfieUrl` on the `Promoter` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "public"."Promoter" DROP COLUMN "selfieUrl",
ADD COLUMN     "livePhotoUrl" TEXT;
