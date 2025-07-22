-- AlterTable
ALTER TABLE "Pilot" ADD COLUMN     "isTaxTokenVerified" "VerificationStatus" NOT NULL DEFAULT 'PENDING',
ADD COLUMN     "taxTokenRejectionReason" TEXT,
ADD COLUMN     "taxTokenUrl" TEXT;
