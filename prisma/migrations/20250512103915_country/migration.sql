-- CreateEnum
CREATE TYPE "Country" AS ENUM ('BD', 'IN');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "country" "Country";
