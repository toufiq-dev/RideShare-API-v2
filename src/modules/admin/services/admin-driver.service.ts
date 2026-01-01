import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'src/core/database/database.service';
import { Pilot, Prisma, UserStatus, VerificationStatus } from '@prisma/client';
import { DocumentType } from '../dto/admin.dto';
import {
  ApproveNidDto,
  ApproveSelfieDto,
  ApproveDrivingLicenseDto,
  ApproveVehicleOwnerNidDto,
  ApproveRegistrationCertificateDto,
  ApproveNumberPlateDto,
  ApproveTaxTokenDto,
  FilterDriverDto,
  RejectDocumentDto,
  UpdateDrivingLicenseDto,
  UpdateNidDto,
  UpdateNumberPlateDto,
  UpdateProfileImageDto,
  UpdateRegistrationCardDto,
  UpdateTaxTokenDto,
  UpdateVehicleOwnerNidDto,
  FilterDriverSortOptions,
  FilterDriverSortOrderOptions
} from "../dto/admin-driver.dto";

@Injectable()
export class AdminDriverService {
  private readonly verificationFieldMap: Record<DocumentType, keyof Pilot> = {
    [DocumentType.SELFIE]: 'isSelfieVerified',
    [DocumentType.DRIVING_LICENSE]: 'isDLVerified',
    [DocumentType.NID]: 'isNidVerified',
    [DocumentType.REGISTRATION_CERTIFICATE]: 'isRCVerified',
    [DocumentType.NUMBER_PLATE]: 'isNumberPlateVerified',
    [DocumentType.TAX_TOKEN]: 'isTaxTokenVerified',
    [DocumentType.VEHICLE_OWNERS_NID]: 'isVehicleOwnersNidVerified',
  };

  private readonly rejectionReasonFieldMap: Record<DocumentType, keyof Pilot> =
    {
      [DocumentType.SELFIE]: 'selfieRejectionReason',
      [DocumentType.DRIVING_LICENSE]: 'dlRejectionReason',
      [DocumentType.NID]: 'nidRejectionReason',
      [DocumentType.REGISTRATION_CERTIFICATE]: 'rcRejectionReason',
      [DocumentType.NUMBER_PLATE]: 'numberPlateRejectionReason',
      [DocumentType.TAX_TOKEN]: 'taxTokenRejectionReason',
      [DocumentType.VEHICLE_OWNERS_NID]: 'vehicleOwnersNidRejectionReason',
    };

  private readonly documentUrlFields: Record<DocumentType, string[]> = {
    [DocumentType.SELFIE]: ['selfieUrl'],
    [DocumentType.DRIVING_LICENSE]: ['dlFrontSideUrl', 'dlBackSideUrl'],
    [DocumentType.NID]: ['nidFrontSideUrl', 'nidBackSideUrl'],
    [DocumentType.REGISTRATION_CERTIFICATE]: [
      'rcFrontSideUrl',
      'rcBackSideUrl',
    ],
    [DocumentType.NUMBER_PLATE]: ['numberPlateUrl'],
    [DocumentType.TAX_TOKEN]: ['taxTokenUrl'],
    [DocumentType.VEHICLE_OWNERS_NID]: [
      'vehicleOwnersNidFrontSideUrl',
      'vehicleOwnersNidBackSideUrl',
    ],
  };

  private readonly documentTypeNames: Record<DocumentType, string> = {
    [DocumentType.SELFIE]: 'Selfie',
    [DocumentType.DRIVING_LICENSE]: 'Driving License',
    [DocumentType.NID]: 'NID',
    [DocumentType.REGISTRATION_CERTIFICATE]: 'Registration Certificate',
    [DocumentType.NUMBER_PLATE]: 'Number Plate',
    [DocumentType.TAX_TOKEN]: 'Tax Token',
    [DocumentType.VEHICLE_OWNERS_NID]: 'Vehicle Owner NID',
  };

  constructor(private readonly prisma: PrismaService) { }

  // ==================== Public Methods ====================

  async getDriverList(query: FilterDriverDto) {
    const {
      page = 1,
      pageSize = 10,
      search,
      status,
      sortBy = FilterDriverSortOptions.CREATED_AT as any,
      sortOrder = FilterDriverSortOrderOptions.DESC as any,
      vehicleTypeId,
      startDate,
      endDate,
      updatedStartDate,
      updatedEndDate,
    } = query;

    const skip = (page - 1) * pageSize;
    const whereClause = this.buildWhereClause({
      search,
      status,
      vehicleTypeId,
      startDate,
      endDate,
      updatedStartDate,
      updatedEndDate,
    });

    const orderByClause = this.buildOrderByClause(sortBy, sortOrder);

    try {
      const [totalCount, pendingCount, suspendedCount, activeCount, pilots] =
        await Promise.all([
          this.prisma.pilot.count({ where: whereClause }),
          this.prisma.pilot.count({
            where: { ...whereClause, user: { status: UserStatus.IN_REVIEW } },
          }),
          this.prisma.pilot.count({
            where: { ...whereClause, user: { status: UserStatus.SUSPENDED } },
          }),
          this.prisma.pilot.count({
            where: { ...whereClause, user: { status: UserStatus.ACTIVE } },
          }),
          this.prisma.pilot.findMany({
            where: whereClause,
            orderBy: orderByClause,
            select: {
              id: true,
              name: true,
              phone: true,
              createdAt: true,
              updatedAt: true,
              isDLVerified: true,
              isRCVerified: true,
              isNidVerified: true,
              isVehicleOwnersNidVerified: true,
              isNumberPlateVerified: true,
              isTaxTokenVerified: true,
              isSelfieVerified: true,
              vehicle: {
                select: {
                  vehicleTypeBD: {
                    select: { name: true },
                  },
                },
              },
              documentSubmissions: {
                select: {
                  submittedAt: true,
                  documentType: true,
                  verificationStatus: true,
                },
              },
            },
            skip,
            take: +pageSize || 10,
          }),
        ]);

      const totalPages = Math.ceil(totalCount / pageSize);

      return {
        message: 'Driver list fetched successfully.',
        data: {
          pilots: pilots,
          totalPilots: totalCount,
          pendingPilots: pendingCount,
          suspendedPilots: suspendedCount,
          activePilots: activeCount,
          pagination: {
            totalItems: totalCount,
            totalPages,
            currentPage: +page,
            pageSize: +pageSize,
            hasNextPage: page < totalPages,
            hasPrevPage: page > 1,
          },
        },
      };
    } catch (error) {
      throw this.handleError(
        error,
        'Failed to fetch driver list. Please try again later.',
      );
    }
  }

  async getDriverDetails(id: string) {
    try {
      const pilot = await this.prisma.pilot.findUnique({
        where: { id },
        select: {
          id: true,
          phone: true,
          isDLVerified: true,
          isRCVerified: true,
          isNidVerified: true,
          isSelfieVerified: true,
          isVehicleOwnersNidVerified: true,
          isNumberPlateVerified: true,
          isTaxTokenVerified: true,
          isFairCoinAvailed: true,
          selfieUrl: true,
          nidFrontSideUrl: true,
          nidBackSideUrl: true,
          vehicleOwnersNidFrontSideUrl: true,
          vehicleOwnersNidBackSideUrl: true,
          rcFrontSideUrl: true,
          rcBackSideUrl: true,
          numberPlateUrl: true,
          taxTokenUrl: true,
          dlFrontSideUrl: true,
          dlBackSideUrl: true,
          nidRejectionReason: true,
          selfieRejectionReason: true,
          dlRejectionReason: true,
          rcRejectionReason: true,
          numberPlateRejectionReason: true,
          taxTokenRejectionReason: true,
          vehicleOwnersNidRejectionReason: true,
          drivingLicense: {
            select: {
              nameOnLicense: true,
              dateOfBirth: true,
              licenseNumber: true,
              validUntill: true,
              dateOfIssue: true,
            },
          },
          wallet: {
            select: {
              balance: true,
              subscription: {
                select: {
                  name: true,
                },
              },
            },
          },
          vehicle: {
            select: {
              regNo: true,
              model: true,
              colour: true,
              registrationDate: true,
              vehicleTypeBD: {
                select: {
                  name: true,
                  passengerCapacity: true,
                },
              },
            },
          },
          nid: true,
          user: {
            select: {
              status: true,
            },
          },
          documentSubmissions: {
            select: {
              id: true,
              documentType: true,
              verificationStatus: true,
              submittedAt: true,
              reviewedBy: {
                select: {
                  admin: {
                    select: {
                      name: true,
                    },
                  },
                  superAdmin: {
                    select: {
                      name: true,
                    },
                  },
                  support: {
                    select: {
                      name: true,
                    },
                  },
                },
              },
              reviewedAt: true,
              rejectionReason: true,
            },
          },
        },
      });

      if (!pilot) {
        throw new NotFoundException(
          'Driver not found. Please verify the driver ID and try again.',
        );
      }

      return {
        message: 'Driver details fetched successfully.',
        data: pilot,
      };
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw this.handleError(
        error,
        'Failed to fetch driver details. Please try again later.',
      );
    }
  }

  async updateProfileImage(
    updateProfileImageDto: UpdateProfileImageDto,
    userId: string,
  ) {
    const { pilotId, selfieUrl } = updateProfileImageDto;

    const pilot = await this.findUniquePilot(pilotId);
    this.validatePilotExists(pilot);
    this.validateDocumentNotApproved(pilot, DocumentType.SELFIE);
    await this.validateDocumentNotInReview(pilotId, DocumentType.SELFIE);

    try {
      const updatedPilot = await this.updateDocumentWithTransaction(
        pilotId,
        DocumentType.SELFIE,
        { selfieUrl },
        userId,
        pilot,
      );

      return {
        message: 'Driver profile image uploaded successfully.',
        data: updatedPilot,
      };
    } catch (error) {
      throw this.handleTransactionError(
        error,
        `Failed to upload ${this.documentTypeNames[DocumentType.SELFIE].toLowerCase()}.`,
        DocumentType.SELFIE,
      );
    }
  }

  async updateDrivingLicense(
    updateDrivingLicenseDto: UpdateDrivingLicenseDto,
    userId: string,
  ) {
    const { pilotId, dlFrontSideUrl, dlBackSideUrl, ...drivingLicenseData } =
      updateDrivingLicenseDto;

    const pilot = await this.findUniquePilot(pilotId);
    this.validatePilotExists(pilot);
    this.validateDocumentNotApproved(pilot, DocumentType.DRIVING_LICENSE);
    await this.validateDocumentNotInReview(
      pilotId,
      DocumentType.DRIVING_LICENSE,
    );

    try {
      const updatedPilot = await this.updateDocumentWithTransaction(
        pilotId,
        DocumentType.DRIVING_LICENSE,
        { dlFrontSideUrl, dlBackSideUrl },
        userId,
        pilot,
        async (tx, updatedPilot) => {
          await tx.drivingLicense.upsert({
            where: { pilotId },
            update: {
              ...drivingLicenseData,
              dateOfBirth: new Date(drivingLicenseData.dateOfBirth),
              validUntill: new Date(drivingLicenseData.validUntill),
              updatedAt: updatedPilot.updatedAt,
            },
            create: {
              pilotId,
              ...drivingLicenseData,
              dateOfBirth: new Date(drivingLicenseData.dateOfBirth),
              validUntill: new Date(drivingLicenseData.validUntill),
              createdAt: updatedPilot.updatedAt,
            },
          });
        },
      );

      return {
        message: 'Driving license uploaded successfully.',
        data: updatedPilot,
      };
    } catch (error) {
      throw this.handleTransactionError(
        error,
        `Failed to upload ${this.documentTypeNames[DocumentType.DRIVING_LICENSE].toLowerCase()}.`,
        DocumentType.DRIVING_LICENSE,
      );
    }
  }

  async updateNid(updateNidDto: UpdateNidDto, userId: string) {
    const { pilotId, nidFrontSideUrl, nidBackSideUrl, ...nidData } =
      updateNidDto;

    const pilot = await this.findUniquePilot(pilotId);
    this.validatePilotExists(pilot);
    this.validateDocumentNotApproved(pilot, DocumentType.NID);
    await this.validateDocumentNotInReview(pilotId, DocumentType.NID);

    try {
      const updatedPilot = await this.updateDocumentWithTransaction(
        pilotId,
        DocumentType.NID,
        { nidFrontSideUrl, nidBackSideUrl },
        userId,
        pilot,
        async (tx) => {
          await tx.nid.upsert({
            where: { pilotId },
            update: {
              ...nidData,
              dateOfBirth: new Date(nidData.dateOfBirth),
            },
            create: {
              pilotId,
              ...nidData,
              dateOfBirth: new Date(nidData.dateOfBirth),
            },
          });
        },
      );

      return {
        message: 'NID uploaded successfully.',
        data: updatedPilot,
      };
    } catch (error) {
      throw this.handleTransactionError(
        error,
        `Failed to upload ${this.documentTypeNames[DocumentType.NID].toLowerCase()}.`,
        DocumentType.NID,
      );
    }
  }

  async updateVehicleOwnerNid(
    updateVehicleOwnerNidDto: UpdateVehicleOwnerNidDto,
    userId: string,
  ) {
    const {
      pilotId,
      vehicleOwnersNidFrontSideUrl,
      vehicleOwnersNidBackSideUrl,
      ...vehicleOwnerNidData
    } = updateVehicleOwnerNidDto;

    const pilot = await this.findUniquePilot(pilotId);
    this.validatePilotExists(pilot);
    this.validateDocumentNotApproved(pilot, DocumentType.VEHICLE_OWNERS_NID);
    await this.validateDocumentNotInReview(
      pilotId,
      DocumentType.VEHICLE_OWNERS_NID,
    );

    try {
      const updatedPilot = await this.updateDocumentWithTransaction(
        pilotId,
        DocumentType.VEHICLE_OWNERS_NID,
        { vehicleOwnersNidFrontSideUrl, vehicleOwnersNidBackSideUrl },
        userId,
        pilot,
        async (tx) => {
          await tx.nid.upsert({
            where: { pilotId },
            update: {
              ...vehicleOwnerNidData,
              vehicleOwnerNidDateOfBirth: new Date(
                vehicleOwnerNidData.vehicleOwnerNidDateOfBirth,
              ),
            },
            create: {
              pilotId,
              ...vehicleOwnerNidData,
              vehicleOwnerNidDateOfBirth: new Date(
                vehicleOwnerNidData.vehicleOwnerNidDateOfBirth,
              ),
            },
          });
        },
      );

      return {
        message: 'Vehicle owner NID uploaded successfully.',
        data: updatedPilot,
      };
    } catch (error) {
      throw this.handleTransactionError(
        error,
        `Failed to upload ${this.documentTypeNames[DocumentType.VEHICLE_OWNERS_NID].toLowerCase()}.`,
        DocumentType.VEHICLE_OWNERS_NID,
      );
    }
  }

  async updateRegistrationInfo(
    updateRegistrationCardDto: UpdateRegistrationCardDto,
    userId: string,
  ) {
    const { pilotId, rcFrontSideUrl, rcBackSideUrl, ...registrationCardData } =
      updateRegistrationCardDto;

    const pilot = await this.findUniquePilot(pilotId);
    this.validatePilotExists(pilot);
    this.validateDocumentNotApproved(
      pilot,
      DocumentType.REGISTRATION_CERTIFICATE,
    );
    await this.validateDocumentNotInReview(
      pilotId,
      DocumentType.REGISTRATION_CERTIFICATE,
    );

    try {
      const updatedPilot = await this.updateDocumentWithTransaction(
        pilotId,
        DocumentType.REGISTRATION_CERTIFICATE,
        { rcFrontSideUrl, rcBackSideUrl },
        userId,
        pilot,
        async (tx, updatedPilot) => {
          await tx.vehicle.upsert({
            where: { pilotId },
            update: {
              ...registrationCardData,
              registrationDate: new Date(registrationCardData.registrationDate),
              updatedAt: updatedPilot.updatedAt,
            },
            create: {
              pilotId,
              ...registrationCardData,
              registrationDate: new Date(registrationCardData.registrationDate),
              createdAt: updatedPilot.updatedAt,
            },
          });
        },
      );

      return {
        message: 'Registration certificate uploaded successfully.',
        data: updatedPilot,
      };
    } catch (error) {
      throw this.handleTransactionError(
        error,
        `Failed to upload ${this.documentTypeNames[DocumentType.REGISTRATION_CERTIFICATE].toLowerCase()}.`,
        DocumentType.REGISTRATION_CERTIFICATE,
      );
    }
  }

  async updateNumberPlateInfo(
    updateNumberPlateDto: UpdateNumberPlateDto,
    userId: string,
  ) {
    const { pilotId, numberPlateUrl, regNo } = updateNumberPlateDto;

    const pilot = await this.findUniquePilot(pilotId);
    this.validatePilotExists(pilot);
    this.validateDocumentNotApproved(pilot, DocumentType.NUMBER_PLATE);
    await this.validateDocumentNotInReview(pilotId, DocumentType.NUMBER_PLATE);
    await this.validateVehicleExists(pilotId);

    try {
      const updatedPilot = await this.updateDocumentWithTransaction(
        pilotId,
        DocumentType.NUMBER_PLATE,
        { numberPlateUrl },
        userId,
        pilot,
        async (tx, updatedPilot) => {
          await tx.vehicle.upsert({
            where: { regNo },
            update: {
              regNo,
              updatedAt: updatedPilot.updatedAt,
            },
            create: {
              regNo,
              createdAt: updatedPilot.updatedAt,
              colour: '',
              pilot: { connect: { id: pilotId } },
            },
          });

          await tx.numberPlate.upsert({
            where: { pilotId },
            update: {
              numberPlate: regNo,
              updatedAt: updatedPilot.updatedAt,
            },
            create: {
              pilotId,
              numberPlate: regNo,
              createdAt: updatedPilot.updatedAt,
            },
          });
        },
      );

      return {
        message: 'Number plate uploaded successfully.',
        data: updatedPilot,
      };
    } catch (error) {
      throw this.handleTransactionError(
        error,
        `Failed to upload ${this.documentTypeNames[DocumentType.NUMBER_PLATE].toLowerCase()}.`,
        DocumentType.NUMBER_PLATE,
      );
    }
  }

  async updateTaxTokenInfo(
    updateTaxTokenDto: UpdateTaxTokenDto,
    userId: string,
  ) {
    const { pilotId, taxTokenUrl, ...taxTokenData } = updateTaxTokenDto;

    const pilot = await this.findUniquePilot(pilotId);
    this.validatePilotExists(pilot);
    this.validateDocumentNotApproved(pilot, DocumentType.TAX_TOKEN);
    await this.validateDocumentNotInReview(pilotId, DocumentType.TAX_TOKEN);
    await this.validateVehicleExists(pilotId);

    try {
      const updatedPilot = await this.updateDocumentWithTransaction(
        pilotId,
        DocumentType.TAX_TOKEN,
        { taxTokenUrl },
        userId,
        pilot,
        async (tx, updatedPilot) => {
          await tx.vehicle.upsert({
            where: { regNo: taxTokenData.regNo },
            update: {
              ...taxTokenData,
              registrationDate: new Date(taxTokenData.registrationDate),
              updatedAt: updatedPilot.updatedAt,
            },
            create: {
              pilotId,
              ...taxTokenData,
              registrationDate: new Date(taxTokenData.registrationDate),
              createdAt: updatedPilot.updatedAt,
            },
          });

          await tx.taxToken.upsert({
            where: { pilotId },
            update: {
              registrationNumber: taxTokenData.regNo,
              updatedAt: updatedPilot.updatedAt,
            },
            create: {
              pilotId,
              registrationNumber: taxTokenData.regNo,
              createdAt: updatedPilot.updatedAt,
            },
          });
        },
      );

      return {
        message: 'Tax token uploaded successfully.',
        data: updatedPilot,
      };
    } catch (error) {
      throw this.handleTransactionError(
        error,
        `Failed to upload ${this.documentTypeNames[DocumentType.TAX_TOKEN].toLowerCase()}.`,
        DocumentType.TAX_TOKEN,
      );
    }
  }

  async rejectDocument(rejectDocumentDto: RejectDocumentDto, userId: string) {
    const { pilotId, documentType, rejectionReason } = rejectDocumentDto;

    const user = await this.findUserWithRole(userId);
    const pilot = await this.findUniquePilot(pilotId);
    this.validatePilotExists(pilot);

    const verificationField = this.verificationFieldMap[documentType];
    const rejectionField = this.rejectionReasonFieldMap[documentType];

    if (!verificationField || !rejectionField) {
      throw new BadRequestException(
        `Unsupported document type: ${documentType}. Please contact support.`,
      );
    }

    const currentStatus = pilot[verificationField] as VerificationStatus;
    this.validateDocumentStatusForRejection(currentStatus, documentType);

    const documentSubmission = await this.findDocumentSubmission(
      pilotId,
      documentType,
    );
    if (!documentSubmission) {
      throw new BadRequestException(
        `${this.documentTypeNames[documentType]} submission not found. The document may not have been submitted for review.`,
      );
    }

    try {
      const updatedPilot = await this.prisma.$transaction(async (tx) => {
        const updatedPilot = await tx.pilot.update({
          where: { id: pilotId },
          data: {
            [verificationField]: VerificationStatus.REJECTED,
            [rejectionField]: rejectionReason,
            updatedAt: new Date(),
          },
        });

        await tx.adminDocumentSubmission.update({
          where: { id: documentSubmission.id },
          data: {
            verificationStatus: VerificationStatus.REJECTED,
            updatedAt: new Date(),
            reviewedByUserId: userId,
            reviewedAt: new Date(),
            reviewerRole: user.role,
            rejectionReason: rejectionReason,
          },
        });

        if (pilot.user.status === UserStatus.IN_REVIEW) {
          await tx.user.update({
            where: { id: pilot.userId },
            data: { status: UserStatus.ONBOARDING, updatedAt: new Date() },
          });
        }

        return updatedPilot;
      });

      return {
        message: `${this.documentTypeNames[documentType]} rejected successfully.`,
        data: updatedPilot,
      };
    } catch (error) {
      throw this.handleTransactionError(
        error,
        `Failed to reject ${this.documentTypeNames[documentType].toLowerCase()}.`,
        documentType,
      );
    }
  }

  async approveSelfie(approveSelfieDto: ApproveSelfieDto, userId: string) {
    const { pilotId, updateData } = approveSelfieDto;
    return this.approveDocumentBase(
      pilotId,
      DocumentType.SELFIE,
      userId,
      updateData,
    );
  }

  async approveDrivingLicense(approveDrivingLicenseDto: ApproveDrivingLicenseDto, userId: string) {
    const { pilotId, updateData } = approveDrivingLicenseDto;
    return this.approveDocumentBase(
      pilotId,
      DocumentType.DRIVING_LICENSE,
      userId,
      updateData,
    );
  }

  async approveNid(approveNidDto: ApproveNidDto, userId: string) {
    const { pilotId, updateData } = approveNidDto;
    return this.approveDocumentBase(
      pilotId,
      DocumentType.NID,
      userId,
      updateData,
    );
  }

  async approveVehicleOwnerNid(approveVehicleOwnerNidDto: ApproveVehicleOwnerNidDto, userId: string) {
    const { pilotId, updateData } = approveVehicleOwnerNidDto;
    return this.approveDocumentBase(
      pilotId,
      DocumentType.VEHICLE_OWNERS_NID,
      userId,
      updateData,
    );
  }

  async approveRegistrationCertificate(approveRegistrationCertificateDto: ApproveRegistrationCertificateDto, userId: string) {
    const { pilotId, updateData } = approveRegistrationCertificateDto;
    return this.approveDocumentBase(
      pilotId,
      DocumentType.REGISTRATION_CERTIFICATE,
      userId,
      updateData,
    );
  }

  async approveNumberPlate(approveNumberPlateDto: ApproveNumberPlateDto, userId: string) {
    const { pilotId, updateData } = approveNumberPlateDto;
    return this.approveDocumentBase(
      pilotId,
      DocumentType.NUMBER_PLATE,
      userId,
      updateData,
    );
  }

  async approveTaxToken(approveTaxTokenDto: ApproveTaxTokenDto, userId: string) {
    const { pilotId, updateData } = approveTaxTokenDto;
    return this.approveDocumentBase(
      pilotId,
      DocumentType.TAX_TOKEN,
      userId,
      updateData,
    );
  }

  // Add this helper method
  private async updateRelatedDocumentData(
    tx: Prisma.TransactionClient,
    pilotId: string,
    documentType: DocumentType,
    updateData: any,
    updatedAt: Date,
  ) {
    switch (documentType) {
      case DocumentType.DRIVING_LICENSE:
        if (updateData.nameOnLicense || updateData.dateOfBirth || updateData.licenseNumber || updateData.validUntill) {
          const dlData: any = {};
          if (updateData.nameOnLicense) dlData.nameOnLicense = updateData.nameOnLicense;
          if (updateData.licenseNumber) dlData.licenseNumber = updateData.licenseNumber;
          if (updateData.dateOfBirth) dlData.dateOfBirth = new Date(updateData.dateOfBirth);
          if (updateData.validUntill) dlData.validUntill = new Date(updateData.validUntill);

          await tx.drivingLicense.upsert({
            where: { pilotId },
            update: { ...dlData, updatedAt },
            create: { pilotId, ...dlData, createdAt: updatedAt },
          });
        }
        break;

      case DocumentType.NID:
        if (updateData.name || updateData.dateOfBirth || updateData.nidNumber) {
          const nidData: any = {};
          if (updateData.name) nidData.name = updateData.name;
          if (updateData.nidNumber) nidData.nidNumber = updateData.nidNumber;
          if (updateData.dateOfBirth) nidData.dateOfBirth = new Date(updateData.dateOfBirth);

          await tx.nid.upsert({
            where: { pilotId },
            update: nidData,
            create: { pilotId, ...nidData },
          });
        }
        break;

      case DocumentType.VEHICLE_OWNERS_NID:
        if (updateData.vehicleOwnerNidName || updateData.vehicleOwnerNidDateOfBirth || updateData.vehicleOwnerNidNumber) {
          const vehicleOwnerData: any = {};
          if (updateData.vehicleOwnerNidName) vehicleOwnerData.vehicleOwnerNidName = updateData.vehicleOwnerNidName;
          if (updateData.vehicleOwnerNidNumber) vehicleOwnerData.vehicleOwnerNidNumber = updateData.vehicleOwnerNidNumber;
          if (updateData.vehicleOwnerNidDateOfBirth) vehicleOwnerData.vehicleOwnerNidDateOfBirth = new Date(updateData.vehicleOwnerNidDateOfBirth);

          await tx.nid.upsert({
            where: { pilotId },
            update: vehicleOwnerData,
            create: { pilotId, ...vehicleOwnerData },
          });
        }
        break;

      case DocumentType.REGISTRATION_CERTIFICATE:
        if (updateData.regNo || updateData.vehicleTypeIdBD || updateData.colour || updateData.registrationDate) {
          const vehicleData: any = {};
          if (updateData.regNo) vehicleData.regNo = updateData.regNo;
          if (updateData.vehicleTypeIdBD) vehicleData.vehicleTypeIdBD = updateData.vehicleTypeIdBD;
          if (updateData.colour) vehicleData.colour = updateData.colour;
          if (updateData.registrationDate) vehicleData.registrationDate = new Date(updateData.registrationDate);

          await tx.vehicle.upsert({
            where: { pilotId },
            update: { ...vehicleData, updatedAt },
            create: { pilotId, ...vehicleData, createdAt: updatedAt },
          });
        }
        break;

      case DocumentType.NUMBER_PLATE:
        if (updateData.regNo) {
          await tx.vehicle.upsert({
            where: { regNo: updateData.regNo },
            update: { regNo: updateData.regNo, updatedAt },
            create: { regNo: updateData.regNo, createdAt: updatedAt, colour: "", pilot: { connect: { id: pilotId } } },
          });

          await tx.numberPlate.upsert({
            where: { pilotId },
            update: { numberPlate: updateData.regNo, updatedAt },
            create: { pilotId, numberPlate: updateData.regNo, createdAt: updatedAt },
          });
        }
        break;

      case DocumentType.TAX_TOKEN:
        if (updateData.regNo || updateData.vehicleTypeIdBD || updateData.colour || updateData.registrationDate) {
          const taxTokenVehicleData: any = {};
          if (updateData.regNo) taxTokenVehicleData.regNo = updateData.regNo;
          if (updateData.vehicleTypeIdBD) taxTokenVehicleData.vehicleTypeIdBD = updateData.vehicleTypeIdBD;
          if (updateData.colour) taxTokenVehicleData.colour = updateData.colour;
          if (updateData.registrationDate) taxTokenVehicleData.registrationDate = new Date(updateData.registrationDate);

          await tx.vehicle.upsert({
            where: { regNo: updateData.regNo },
            update: { ...taxTokenVehicleData, updatedAt },
            create: { pilotId, ...taxTokenVehicleData, createdAt: updatedAt },
          });

          await tx.taxToken.upsert({
            where: { pilotId },
            update: { registrationNumber: updateData.regNo, updatedAt },
            create: { pilotId, registrationNumber: updateData.regNo, createdAt: updatedAt },
          });
        }
        break;
    }
  }

  private async approveDocumentBase(
    pilotId: string,
    documentType: DocumentType,
    userId: string,
    updateData?: any,
  ) {
    const user = await this.findUserWithRole(userId);
    const pilot = await this.findUniquePilot(pilotId);
    this.validatePilotExists(pilot);

    const verificationField = this.verificationFieldMap[documentType];
    const rejectionField = this.rejectionReasonFieldMap[documentType];

    if (!verificationField || !rejectionField) {
      throw new BadRequestException(`Unsupported document type: ${documentType}. Please contact support.`);
    }

    if (pilot[verificationField] === VerificationStatus.APPROVED) {
      throw new BadRequestException(`${this.documentTypeNames[documentType]} has already been approved.`);
    }

    const documentSubmission = await this.findDocumentSubmission(pilotId, documentType);
    if (!documentSubmission) {
      throw new BadRequestException(
        `${this.documentTypeNames[documentType]} submission not found. The document may not have been submitted for review.`
      );
    }

    try {
      const updatedPilot = await this.prisma.$transaction(async (tx) => {
        const updatedAt = new Date();

        // Base pilot update data
        const pilotUpdateData: any = {
          [verificationField]: VerificationStatus.APPROVED,
          [rejectionField]: null,
          updatedAt,
        };

        // Add document-specific updates if provided
        if (updateData) {
          switch (documentType) {
            case DocumentType.SELFIE:
              if (updateData.selfieUrl) pilotUpdateData.selfieUrl = updateData.selfieUrl;
              break;
            case DocumentType.DRIVING_LICENSE:
              if (updateData.dlFrontSideUrl) pilotUpdateData.dlFrontSideUrl = updateData.dlFrontSideUrl;
              if (updateData.dlBackSideUrl) pilotUpdateData.dlBackSideUrl = updateData.dlBackSideUrl;
              break;
            case DocumentType.NID:
              if (updateData.nidFrontSideUrl) pilotUpdateData.nidFrontSideUrl = updateData.nidFrontSideUrl;
              if (updateData.nidBackSideUrl) pilotUpdateData.nidBackSideUrl = updateData.nidBackSideUrl;
              break;
            case DocumentType.VEHICLE_OWNERS_NID:
              if (updateData.vehicleOwnersNidFrontSideUrl) {
                pilotUpdateData.vehicleOwnersNidFrontSideUrl = updateData.vehicleOwnersNidFrontSideUrl;
              }
              if (updateData.vehicleOwnersNidBackSideUrl) {
                pilotUpdateData.vehicleOwnersNidBackSideUrl = updateData.vehicleOwnersNidBackSideUrl;
              }
              break;
            case DocumentType.REGISTRATION_CERTIFICATE:
              if (updateData.rcFrontSideUrl) pilotUpdateData.rcFrontSideUrl = updateData.rcFrontSideUrl;
              if (updateData.rcBackSideUrl) pilotUpdateData.rcBackSideUrl = updateData.rcBackSideUrl;
              break;
            case DocumentType.NUMBER_PLATE:
              if (updateData.numberPlateUrl) pilotUpdateData.numberPlateUrl = updateData.numberPlateUrl;
              break;
            case DocumentType.TAX_TOKEN:
              if (updateData.taxTokenUrl) pilotUpdateData.taxTokenUrl = updateData.taxTokenUrl;
              break;
          }
        }

        // Update pilot
        const updatedPilot = await tx.pilot.update({
          where: { id: pilotId },
          data: pilotUpdateData,
        });

        // Handle additional related data updates
        if (updateData) {
          await this.updateRelatedDocumentData(tx, pilotId, documentType, updateData, updatedAt);
        }

        // Update document submission
        await tx.adminDocumentSubmission.update({
          where: { id: documentSubmission.id },
          data: {
            verificationStatus: VerificationStatus.APPROVED,
            updatedAt,
            reviewedByUserId: userId,
            reviewedAt: updatedAt,
            reviewerRole: user.role,
          },
        });

        // Update user status if all documents approved
        if (this.isAllDocumentsApproved(updatedPilot)) {
          await tx.user.update({
            where: { id: pilot.userId },
            data: { status: UserStatus.ACTIVE, updatedAt },
          });
        }

        return updatedPilot;
      });

      return {
        message: `${this.documentTypeNames[documentType]} approved successfully.`,
        data: updatedPilot,
      };
    } catch (error) {
      throw this.handleTransactionError(
        error,
        `Failed to approve ${this.documentTypeNames[documentType].toLowerCase()}.`,
        documentType,
      );
    }
  }

  private buildWhereClause(params: {
    search?: string;
    status?: string;
    vehicleTypeId?: string;
    startDate?: string;
    endDate?: string;
    updatedStartDate?: string;
    updatedEndDate?: string;
  }): Prisma.PilotWhereInput {
    const {
      search,
      status,
      vehicleTypeId,
      startDate,
      endDate,
      updatedStartDate,
      updatedEndDate,
    } = params;
    const whereClause: Prisma.PilotWhereInput = {};

    if (status) {
      whereClause.user = { status: status as UserStatus };
    }

    if (search?.trim()) {
      whereClause.OR = [
        { name: { contains: search.trim(), mode: 'insensitive' } },
        { phone: { contains: search.trim(), mode: 'insensitive' } },
      ];
    }

    if (startDate || endDate) {
      whereClause.createdAt = {};
      if (startDate) whereClause.createdAt.gte = new Date(startDate);
      if (endDate) whereClause.createdAt.lte = new Date(endDate);
    }

    if (updatedStartDate || updatedEndDate) {
      whereClause.updatedAt = {};
      if (updatedStartDate)
        whereClause.updatedAt.gte = new Date(updatedStartDate);
      if (updatedEndDate) whereClause.updatedAt.lte = new Date(updatedEndDate);
    }

    if (vehicleTypeId) {
      whereClause.vehicle = {
        vehicleTypeBD: { id: vehicleTypeId },
      };
    }

    return whereClause;
  }

  private buildOrderByClause(
    sortBy: string,
    sortOrder: string,
  ): Prisma.PilotOrderByWithRelationInput {
    const orderMap: Record<string, Prisma.PilotOrderByWithRelationInput> = {
      [FilterDriverSortOptions.UPDATED_AT]: {
        updatedAt:
          sortOrder === FilterDriverSortOrderOptions.ASC ? 'asc' : 'desc',
      },
      [FilterDriverSortOptions.CREATED_AT]: {
        createdAt:
          sortOrder === FilterDriverSortOrderOptions.ASC ? 'asc' : 'desc',
      },
      [FilterDriverSortOptions.NAME]: {
        name: sortOrder === FilterDriverSortOrderOptions.ASC ? 'asc' : 'desc',
      },
      [FilterDriverSortOptions.MOST_DOCUMENTS_UPLOADED]: {
        documentSubmissions: {
          _count: 'desc',
        },
      },
      [FilterDriverSortOptions.LEAST_DOCUMENTS_UPLOADED]: {
        documentSubmissions: {
          _count: 'asc',
        },
      },
    };

    return orderMap[sortBy] || { createdAt: 'desc' };
  }

  private async findUniquePilot(pilotId: string) {
    return await this.prisma.pilot.findUnique({
      where: { id: pilotId },
      select: {
        id: true,
        userId: true,
        selfieUrl: true,
        rcBackSideUrl: true,
        rcFrontSideUrl: true,
        nidBackSideUrl: true,
        nidFrontSideUrl: true,
        dlBackSideUrl: true,
        dlFrontSideUrl: true,
        vehicleOwnersNidBackSideUrl: true,
        vehicleOwnersNidFrontSideUrl: true,
        numberPlateUrl: true,
        taxTokenUrl: true,
        isSelfieVerified: true,
        isNidVerified: true,
        isDLVerified: true,
        isRCVerified: true,
        isNumberPlateVerified: true,
        isTaxTokenVerified: true,
        isVehicleOwnersNidVerified: true,
        user: {
          select: {
            status: true,
          },
        },
      },
    });
  }

  private validatePilotExists(pilot: any): void {
    if (!pilot) {
      throw new NotFoundException(
        'Driver not found. Please verify the driver ID and try again.',
      );
    }
  }

  private validateDocumentNotApproved(
    pilot: any,
    documentType: DocumentType,
  ): void {
    const verificationField = this.verificationFieldMap[documentType];
    if (pilot[verificationField] === VerificationStatus.APPROVED) {
      throw new BadRequestException(
        `${this.documentTypeNames[documentType]} has already been approved and cannot be updated.`,
      );
    }
  }

  private async validateDocumentNotInReview(
    pilotId: string,
    documentType: DocumentType,
  ): Promise<void> {
    const existingSubmission = await this.findDocumentSubmission(
      pilotId,
      documentType,
    );
    if (existingSubmission) {
      throw new BadRequestException(
        `${this.documentTypeNames[documentType]} is already under review. Please wait for the current review to complete.`,
      );
    }
  }

  private async validateVehicleExists(pilotId: string): Promise<void> {
    const vehicle = await this.prisma.vehicle.findFirst({
      where: { pilotId },
    });

    if (!vehicle) {
      throw new BadRequestException(
        'Vehicle registration is required before uploading this document. Please submit vehicle registration information first.',
      );
    }
  }

  private validateDocumentStatusForRejection(
    currentStatus: VerificationStatus,
    documentType: DocumentType,
  ): void {
    if (currentStatus === VerificationStatus.APPROVED) {
      throw new BadRequestException(
        `${this.documentTypeNames[documentType]} has already been approved and cannot be rejected.`,
      );
    }

    if (currentStatus === VerificationStatus.PENDING) {
      throw new BadRequestException(
        `${this.documentTypeNames[documentType]} is not currently under review and cannot be rejected.`,
      );
    }

    if (currentStatus === VerificationStatus.REJECTED) {
      throw new BadRequestException(
        `${this.documentTypeNames[documentType]} has already been rejected.`,
      );
    }
  }

  private async findUserWithRole(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, role: true },
    });

    if (!user) {
      throw new NotFoundException(
        'User not found. Please verify your authentication and try again.',
      );
    }

    return user;
  }

  private async findDocumentSubmission(
    pilotId: string,
    documentType: DocumentType,
  ) {
    return await this.prisma.adminDocumentSubmission.findFirst({
      where: {
        pilotId,
        documentType,
        verificationStatus: VerificationStatus.PENDING,
      },
    });
  }

  private async updateDocumentWithTransaction(
    pilotId: string,
    documentType: DocumentType,
    urlFields: Record<string, string | undefined>,
    userId: string,
    pilot: any,
    additionalOperations?: (
      tx: Prisma.TransactionClient,
      updatedPilot: Pilot,
    ) => Promise<void>,
  ) {
    return await this.prisma.$transaction(async (tx) => {
      const updatedAt = new Date();
      const verificationField = this.verificationFieldMap[documentType];
      const rejectionField = this.rejectionReasonFieldMap[documentType];
      const requiredFields = this.documentUrlFields[documentType];

      const pilotUpdateData: any = {
        updatedAt,
        [rejectionField]: null,
      };

      for (const [field, value] of Object.entries(urlFields)) {
        if (value) {
          pilotUpdateData[field] = value;
        }
      }

      const allRequiredFieldsPresent = requiredFields.every(
        (field) =>
          pilotUpdateData[field] !== undefined &&
          pilotUpdateData[field] !== null,
      );

      pilotUpdateData[verificationField] = allRequiredFieldsPresent
        ? VerificationStatus.IN_PROGRESS
        : VerificationStatus.PENDING;

      const updatedPilot = await tx.pilot.update({
        where: { id: pilotId },
        data: pilotUpdateData,
      });

      if (additionalOperations) {
        await additionalOperations(tx, updatedPilot);
      }

      await tx.adminDocumentSubmission.create({
        data: {
          pilotId,
          documentType,
          verificationStatus: VerificationStatus.PENDING,
          createdAt: updatedAt,
          submittedByUserId: userId,
        },
      });

      const expectedStatus = this.isAllDocumentsUploaded(updatedPilot)
        ? UserStatus.IN_REVIEW
        : UserStatus.ONBOARDING;

      if (pilot.user.status !== expectedStatus) {
        await tx.user.update({
          where: { id: pilot.userId },
          data: { status: expectedStatus, updatedAt },
        });
      }

      return updatedPilot;
    });
  }

  private isAllDocumentsUploaded(pilot: Pilot): boolean {
    return [
      pilot.selfieUrl,
      pilot.rcBackSideUrl,
      pilot.rcFrontSideUrl,
      pilot.nidBackSideUrl,
      pilot.nidFrontSideUrl,
      pilot.dlBackSideUrl,
      pilot.dlFrontSideUrl,
      pilot.vehicleOwnersNidBackSideUrl,
      pilot.vehicleOwnersNidFrontSideUrl,
      pilot.numberPlateUrl,
      pilot.taxTokenUrl,
    ].every((document) => document !== null);
  }

  private isAllDocumentsApproved(pilot: Pilot): boolean {
    return [
      pilot.isSelfieVerified,
      pilot.isNidVerified,
      pilot.isDLVerified,
      pilot.isRCVerified,
      pilot.isNumberPlateVerified,
      pilot.isTaxTokenVerified,
      pilot.isVehicleOwnersNidVerified,
    ].every((status) => status === VerificationStatus.APPROVED);
  }

  private handleTransactionError(
    error: any,
    defaultMessage: string,
    documentType?: DocumentType,
  ): BadRequestException {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      switch (error.code) {
        case 'P2002':
          const targetFields =
            (error.meta?.target as string[])?.join(', ') || 'field';
          return new BadRequestException(
            `${defaultMessage} A record with this ${targetFields} already exists. Please verify the data and try again.`,
          );
        case 'P2025':
          return new BadRequestException(
            `${defaultMessage} The requested record was not found. It may have been deleted or does not exist.`,
          );
        case 'P2003':
          return new BadRequestException(
            `${defaultMessage} Invalid reference detected. Please verify all related records exist and try again.`,
          );
        case 'P2014':
          return new BadRequestException(
            `${defaultMessage} Required relationship is missing. Please ensure all required data is provided.`,
          );
        case 'P2001':
          return new BadRequestException(
            `${defaultMessage} The record does not exist. Please verify the information and try again.`,
          );
        default:
          return new BadRequestException(
            `${defaultMessage} Database operation failed. Please try again later or contact support if the issue persists.`,
          );
      }
    }

    if (error instanceof Prisma.PrismaClientValidationError) {
      return new BadRequestException(
        `${defaultMessage} Invalid data provided. Please verify all required fields are correctly formatted.`,
      );
    }

    if (
      error?.message?.includes('timeout') ||
      error?.message?.includes('connection')
    ) {
      return new BadRequestException(
        `${defaultMessage} Database connection timeout. Please try again in a moment.`,
      );
    }

    if (
      error instanceof BadRequestException ||
      error instanceof NotFoundException ||
      error instanceof ConflictException
    ) {
      return error;
    }

    console.error('Transaction error:', error);
    return new BadRequestException(
      `${defaultMessage} An unexpected error occurred. Please try again or contact support if the problem persists.`,
    );
  }

  private handleError(
    error: any,
    defaultMessage: string,
  ): BadRequestException | Error {
    if (
      error instanceof BadRequestException ||
      error instanceof NotFoundException
    ) {
      return error;
    }

    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      return this.handleTransactionError(error, defaultMessage);
    }

    console.error('Service error:', error);
    return new BadRequestException(defaultMessage);
  }
}
