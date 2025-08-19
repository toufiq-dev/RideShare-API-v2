import { VerificationStatus } from '@prisma/client';
import { DocumentType } from './dto/admin.dto';

export const CouponsNames = {
  MINI: 'Mini',
} as const;

export const PilotCouponsNames = {
  BONUS_AUTO_RECHARGE: 'FAIR100',
} as const;

export interface DocumentValidation {
  documentType: DocumentType;
  reviewedOn: string;
  reviewedBy: string;
  verificationStatus: VerificationStatus;
  rejectionReason: string;
}
