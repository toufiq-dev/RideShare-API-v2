-- AlterTable
ALTER TABLE "Pilot" ADD COLUMN     "isVehicleOwnersNidVerified" "VerificationStatus" NOT NULL DEFAULT 'PENDING',
ADD COLUMN     "vehicleOwnersNidBackSideUrl" TEXT,
ADD COLUMN     "vehicleOwnersNidFrontSideUrl" TEXT,
ADD COLUMN     "vehicleOwnersNidRejectionReason" TEXT;
