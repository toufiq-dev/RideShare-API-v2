import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "src/core/database/database.service";
import { PilotService } from "src/modules/pilot/pilot.service";
import { ApproveDocumentDto, FilterDriverDto, FilterDriverSortOptions, FilterDriverSortOrderOptions, RejectDocumentDto, UpdateDrivingLicenseDto, UpdateNidDto, UpdateNumberPlateDto, UpdateProfileImageDto, UpdateRegistrationCardDto, UpdateTaxTokenDto, UpdateVehicleOwnerNidDto } from "../dto/admin-driver.dto";
import { Pilot, UserStatus, VerificationStatus } from "@prisma/client";
import { DocumentType } from "../dto/admin.dto";

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

    private readonly rejectionReasonFieldMap: Record<DocumentType, keyof Pilot> = {
        [DocumentType.SELFIE]: 'selfieRejectionReason',
        [DocumentType.DRIVING_LICENSE]: 'dlRejectionReason',
        [DocumentType.NID]: 'nidRejectionReason',
        [DocumentType.REGISTRATION_CERTIFICATE]: 'rcRejectionReason',
        [DocumentType.NUMBER_PLATE]: 'numberPlateRejectionReason',
        [DocumentType.TAX_TOKEN]: 'taxTokenRejectionReason',
        [DocumentType.VEHICLE_OWNERS_NID]: 'vehicleOwnersNidRejectionReason',
    };

    constructor(
        private readonly prisma: PrismaService,
        private readonly pilotService: PilotService,
    ) { }


    async getDriverList(query: FilterDriverDto) {
        try {
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

            const whereClause: any = {};

            if (status) {
                whereClause.user = {
                    status: status as UserStatus,
                };
            }

            if (search && search.trim()) {
                whereClause.OR = [
                    { name: { contains: search.trim(), mode: 'insensitive' } },
                    { phone: { contains: search.trim(), mode: 'insensitive' } },
                ];
            }

            if (startDate || endDate) {
                whereClause.createdAt = {};
                if (startDate) {
                    whereClause.createdAt.gte = new Date(startDate);
                }
                if (endDate) {
                    whereClause.createdAt.lte = new Date(endDate);
                }
            }

            if (updatedStartDate || updatedEndDate) {
                whereClause.updatedAt = {};
                if (updatedStartDate) {
                    whereClause.updatedAt.gte = new Date(updatedStartDate);
                }
                if (updatedEndDate) {
                    whereClause.updatedAt.lte = new Date(updatedEndDate);
                }
            }

            if (vehicleTypeId) {
                whereClause.vehicle = {
                    vehicleTypeBD: {
                        id: vehicleTypeId,
                    }
                }
            }

            let orderByClause: any = {};

            if (
                sortBy === FilterDriverSortOptions.MOST_DOCUMENTS_UPLOADED ||
                sortBy === FilterDriverSortOptions.LEAST_DOCUMENTS_UPLOADED
            ) {
                orderByClause = { createdAt: sortOrder === FilterDriverSortOrderOptions.ASC ? 'asc' : 'desc' };
                // orderByClause = {
                //   _documentCount: sortOrder === FilterDriverSortOrderOptions.ASC ? 'asc' : 'desc',
                // }
            } else if (sortBy === FilterDriverSortOptions.UPDATED_AT) {
                orderByClause = {
                    updatedAt: sortOrder === FilterDriverSortOrderOptions.ASC ? 'asc' : 'desc',
                };
            } else if (sortBy === FilterDriverSortOptions.CREATED_AT) {
                orderByClause = {
                    createdAt: sortOrder === FilterDriverSortOrderOptions.ASC ? 'asc' : 'desc',
                };
            } else if (sortBy === FilterDriverSortOptions.NAME) {
                orderByClause = {
                    name: sortOrder === FilterDriverSortOrderOptions.ASC ? 'asc' : 'desc',
                };
            } else {
                orderByClause = { createdAt: 'desc' };
            }

            const totalCount = await this.prisma.pilot.count({
                where: whereClause,
            });

            const pendingCount = await this.prisma.pilot.count({
                where: {
                    ...whereClause,
                    user: {
                        status: UserStatus.IN_REVIEW,
                    },
                },
            });

            const suspendedCount = await this.prisma.pilot.count({
                where: {
                    ...whereClause,
                    user: {
                        status: UserStatus.SUSPENDED,
                    },
                },
            });

            const activeCount = await this.prisma.pilot.count({
                where: {
                    ...whereClause,
                    user: {
                        status: UserStatus.ACTIVE,
                    },
                },
            });

            let pilots = await this.prisma.pilot.findMany({
                where: whereClause,
                orderBy: orderByClause,
                // select: selectObject,
                select: {
                    id: true,
                    name: true,
                    phone: true,
                    createdAt: true,
                    updatedAt: true,
                    // nidFrontSideUrl: true,
                    // nidBackSideUrl: true,
                    // vehicleOwnersNidFrontSideUrl: true,
                    // vehicleOwnersNidBackSideUrl: true,
                    // rcFrontSideUrl: true,
                    // rcBackSideUrl: true,
                    // numberPlateUrl: true,
                    // taxTokenUrl: true,
                    // dlFrontSideUrl: true,
                    // dlBackSideUrl: true,
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
                                select: {
                                    name: true,
                                },
                            },
                        }
                    }
                },
                skip,
                take: +pageSize || 10,
            });

            if (
                sortBy === FilterDriverSortOptions.MOST_DOCUMENTS_UPLOADED ||
                sortBy === FilterDriverSortOptions.LEAST_DOCUMENTS_UPLOADED
            ) {
                // Calculate document count for each pilot
                const pilotsWithDocCount = pilots.map((pilot: any) => {
                    const documentFields = [
                        'nidFrontSideUrl',
                        'nidBackSideUrl',
                        'vehicleOwnersNidFrontSideUrl',
                        'vehicleOwnersNidBackSideUrl',
                        'rcFrontSideUrl',
                        'rcBackSideUrl',
                        'numberPlateUrl',
                        'taxTokenUrl',
                        'dlFrontSideUrl',
                        'dlBackSideUrl',
                        'selfieUrl',
                    ];

                    let docCount = 0;
                    for (const field of documentFields) {
                        if (pilot[field] && pilot[field] !== null) {
                            docCount++;
                        }
                    }

                    return {
                        ...pilot,
                        _documentCount: docCount,
                    };
                });

                // Sort by document count
                pilotsWithDocCount.sort((a, b) => {
                    if (sortBy === FilterDriverSortOptions.MOST_DOCUMENTS_UPLOADED) {
                        return b._documentCount - a._documentCount;
                    } else {
                        return a._documentCount - b._documentCount;
                    }
                });
                pilots = pilotsWithDocCount.map(({ _documentCount, ...pilot }) => pilot);
            }
            const totalPages = Math.ceil(totalCount / pageSize);
            const hasNextPage = page < totalPages;
            const hasPrevPage = page > 1;

            return {
                message: 'Driver list fetched successfully.',
                data: {
                    pilots,
                    totalPilots: totalCount,
                    pendingPilots: pendingCount,
                    suspendedPilots: suspendedCount,
                    activePilots: activeCount,
                    pagination: {
                        totalItems: totalCount,
                        totalPages,
                        currentPage: +page,
                        pageSize: +pageSize,
                        hasNextPage,
                        hasPrevPage,
                    },
                },
            };
        } catch (error) {
            console.error(error);
            throw error;
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
                    isPanCardVerified: true,
                    isAadhaarVerified: true,
                    isFairCoinAvailed: true,
                    drivingLicense: {
                        select: {
                            nameOnLicense: true,
                            dateOfBirth: true,
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
                            vehicleTypeBD: {
                                select: {
                                    name: true,
                                    passengerCapacity: true,
                                },
                            },
                        },
                    },
                },
            });

            if (!pilot) {
                throw new NotFoundException('Driver not found');
            }

            return {
                message: 'Driver details fetched successfully.',
                data: pilot,
            };
        } catch (error) {
            console.error(error);
            throw error;
        }
    }

    async updateProfileImage(updateProfileImageDto: UpdateProfileImageDto) {
        try {
            const { pilotId, selfieUrl } = updateProfileImageDto;

            const pilot = await this.findUniquePilot(pilotId);

            if (!pilot) {
                throw new NotFoundException('Driver not found');
            }

            if (pilot.isSelfieVerified === VerificationStatus.APPROVED) {
                throw new BadRequestException('Selfie already approved');
            }



            const [updatedPilot] = await this.prisma.$transaction(async (tx) => {

                const updatedAt = new Date();
                const updatedPilot = await tx.pilot.update({
                    where: { id: pilotId },
                    data: {
                        selfieUrl: selfieUrl,
                        isSelfieVerified: VerificationStatus.IN_PROGRESS,
                        updatedAt: updatedAt,
                    },
                });

                const expectedStatus = this.isAllDocumentsUploaded(updatedPilot) ? UserStatus.IN_REVIEW : UserStatus.ONBOARDING;

                if (pilot.user.status !== expectedStatus) {
                    await tx.user.update({
                        where: { id: pilot.userId },
                        data: {
                            status: expectedStatus,
                            updatedAt: updatedAt,
                        },
                    });
                }

                return [updatedPilot];
            });

            if (!updatedPilot) {
                throw new BadRequestException('Failed to upload driver profile');
            }

            return {
                message: 'Driver profile uploaded successfully.',
                data: updatedPilot,
            };
        } catch (error) {
            throw error;
        }
    }

    async updateDrivingLicense(updateDrivingLicenseDto: UpdateDrivingLicenseDto) {
        const { pilotId, dlFrontSideUrl, dlBackSideUrl, ...drivingLicenseData } = updateDrivingLicenseDto;

        const pilot = await this.findUniquePilot(pilotId);

        if (!pilot) {
            throw new NotFoundException('Driver not found');
        }

        if (pilot.isDLVerified === VerificationStatus.APPROVED) {
            throw new BadRequestException('Driving license already approved');
        }

        try {
            const updatedPilot = await this.prisma.$transaction(async (tx) => {

                const updatedAt = new Date();

                const pilotUpdateData: any = {
                    updatedAt: updatedAt,
                };
                if (dlFrontSideUrl) pilotUpdateData.dlFrontSideUrl = dlFrontSideUrl || pilot.dlFrontSideUrl;
                if (dlBackSideUrl) pilotUpdateData.dlBackSideUrl = dlBackSideUrl || pilot.dlBackSideUrl;

                pilotUpdateData.isDLVerified =
                    (pilotUpdateData?.dlFrontSideUrl && pilotUpdateData?.dlBackSideUrl)
                        ? VerificationStatus.IN_PROGRESS
                        : VerificationStatus.PENDING;

                const updatedPilot = await tx.pilot.update({
                    where: { id: pilotId },
                    data: pilotUpdateData,
                });

                await tx.drivingLicense.upsert({
                    where: { pilotId },
                    update: {
                        ...drivingLicenseData,
                        dateOfBirth: new Date(drivingLicenseData.dateOfBirth),
                        validUntill: new Date(drivingLicenseData.validUntill),
                        updatedAt: updatedAt,
                    },
                    create: {
                        pilotId,
                        ...drivingLicenseData,
                        dateOfBirth: new Date(drivingLicenseData.dateOfBirth),
                        validUntill: new Date(drivingLicenseData.validUntill),
                        createdAt: updatedAt,
                    },
                });

                const expectedStatus = this.isAllDocumentsUploaded(updatedPilot)
                    ? UserStatus.IN_REVIEW
                    : UserStatus.ONBOARDING;

                if (pilot.user.status !== expectedStatus) {
                    await tx.user.update({
                        where: { id: pilot.userId },
                        data: { status: expectedStatus, updatedAt: updatedAt },
                    });
                }

                return updatedPilot;
            });

            if (!updatedPilot) {
                throw new BadRequestException('Failed to upload driving license');
            }

            return {
                message: 'Driving license uploaded successfully.',
                data: updatedPilot,
            };
        } catch (error) {
            throw error;
        }
    }

    async updateNid(updateNidDto: UpdateNidDto) {
        try {
            const { pilotId, nidFrontSideUrl, nidBackSideUrl, ...nidData } = updateNidDto;

            const pilot = await this.findUniquePilot(pilotId);

            if (!pilot) {
                throw new NotFoundException('Driver not found');
            }

            if (pilot.isNidVerified === VerificationStatus.APPROVED) {
                throw new BadRequestException('NID already approved');
            }

            const updatedPilot = await this.prisma.$transaction(async (tx) => {
                const updatedAt = new Date();

                const pilotUpdateData: any = {
                    updatedAt: updatedAt,
                };
                if (nidFrontSideUrl) pilotUpdateData.nidFrontSideUrl = nidFrontSideUrl || pilot.nidFrontSideUrl;
                if (nidBackSideUrl) pilotUpdateData.nidBackSideUrl = nidBackSideUrl || pilot.nidBackSideUrl;

                pilotUpdateData.isNidVerified =
                    (pilotUpdateData?.nidFrontSideUrl && pilotUpdateData?.nidBackSideUrl)
                        ? VerificationStatus.IN_PROGRESS
                        : VerificationStatus.PENDING;

                const updatedPilot = await tx.pilot.update({
                    where: { id: pilotId },
                    data: pilotUpdateData,
                });

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

                const expectedStatus = this.isAllDocumentsUploaded(updatedPilot)
                    ? UserStatus.IN_REVIEW
                    : UserStatus.ONBOARDING;

                if (pilot.user.status !== expectedStatus) {
                    await tx.user.update({
                        where: { id: pilot.userId },
                        data: { status: expectedStatus, updatedAt: updatedAt },
                    });
                }

                return updatedPilot;
            });

            return {
                message: 'NID uploaded successfully.',
                data: updatedPilot,
            };
        } catch (error) {
            throw error;
        }
    }

    async updateVehicleOwnerNid(updateVehicleOwnerNidDto: UpdateVehicleOwnerNidDto) {
        try {
            const { pilotId, vehicleOwnersNidFrontSideUrl, vehicleOwnersNidBackSideUrl, ...vehicleOwnerNidData } = updateVehicleOwnerNidDto;

            const pilot = await this.findUniquePilot(pilotId);

            if (!pilot) {
                throw new NotFoundException('Driver not found');
            }

            if (pilot.isVehicleOwnersNidVerified === VerificationStatus.APPROVED) {
                throw new BadRequestException('Vehicle owner NID already approved');
            }

            const updatedPilot = await this.prisma.$transaction(async (tx) => {
                const updatedAt = new Date();

                const pilotUpdateData: any = {
                    updatedAt: updatedAt,
                };
                if (vehicleOwnersNidFrontSideUrl) pilotUpdateData.vehicleOwnersNidFrontSideUrl = vehicleOwnersNidFrontSideUrl || pilot.vehicleOwnersNidFrontSideUrl;
                if (vehicleOwnersNidBackSideUrl) pilotUpdateData.vehicleOwnersNidBackSideUrl = vehicleOwnersNidBackSideUrl || pilot.vehicleOwnersNidBackSideUrl;

                pilotUpdateData.isNidVerified =
                    (pilotUpdateData?.vehicleOwnersNidFrontSideUrl && pilotUpdateData?.vehicleOwnersNidBackSideUrl)
                        ? VerificationStatus.IN_PROGRESS
                        : VerificationStatus.PENDING;

                const updatedPilot = await tx.pilot.update({
                    where: { id: pilotId },
                    data: pilotUpdateData,
                });

                await tx.nid.upsert({
                    where: { pilotId },
                    update: {
                        ...vehicleOwnerNidData,
                        dateOfBirth: new Date(vehicleOwnerNidData.vehicleOwnerNidDateOfBirth),
                    },
                    create: {
                        pilotId,
                        ...vehicleOwnerNidData,
                        dateOfBirth: new Date(vehicleOwnerNidData.vehicleOwnerNidDateOfBirth),
                    },
                });

                const expectedStatus = this.isAllDocumentsUploaded(updatedPilot)
                    ? UserStatus.IN_REVIEW
                    : UserStatus.ONBOARDING;

                if (pilot.user.status !== expectedStatus) {
                    await tx.user.update({
                        where: { id: pilot.userId },
                        data: { status: expectedStatus, updatedAt: updatedAt },
                    });
                }

                return updatedPilot;
            });

            return {
                message: 'Vehicle owner NID uploaded successfully.',
                data: updatedPilot,
            };
        } catch (error) {
            throw error;
        }
    }

    async updateRegistrationInfo(updateRegistrationCardDto: UpdateRegistrationCardDto) {
        try {
            const { pilotId, rcFrontSideUrl, rcBackSideUrl, ...registrationCardData } = updateRegistrationCardDto;

            const pilot = await this.findUniquePilot(pilotId);

            if (!pilot) {
                throw new NotFoundException('Driver not found');
            }

            if (pilot.isRCVerified === VerificationStatus.APPROVED) {
                throw new BadRequestException('Registration certificate already approved');
            }

            const updatedPilot = await this.prisma.$transaction(async (tx) => {
                const updatedAt = new Date();

                const pilotUpdateData: any = {
                    updatedAt: updatedAt,
                };
                if (rcFrontSideUrl) pilotUpdateData.rcFrontSideUrl = rcFrontSideUrl || pilot.rcFrontSideUrl;
                if (rcBackSideUrl) pilotUpdateData.rcBackSideUrl = rcBackSideUrl || pilot.rcBackSideUrl;

                pilotUpdateData.isRCVerified =
                    (pilotUpdateData?.rcFrontSideUrl && pilotUpdateData?.rcBackSideUrl) ? VerificationStatus.IN_PROGRESS : VerificationStatus.PENDING;


                const updatedPilot = await tx.pilot.update({
                    where: { id: pilotId },
                    data: pilotUpdateData,
                });

                await tx.vehicle.upsert({
                    where: { pilotId },
                    update: {
                        ...registrationCardData,
                        registrationDate: new Date(registrationCardData.registrationDate),
                        updatedAt: updatedAt,
                    },
                    create: {
                        pilotId,
                        ...registrationCardData,
                        registrationDate: new Date(registrationCardData.registrationDate),
                        createdAt: updatedAt,
                    },
                });

                const expectedStatus = this.isAllDocumentsUploaded(updatedPilot)
                    ? UserStatus.IN_REVIEW
                    : UserStatus.ONBOARDING;

                if (pilot.user.status !== expectedStatus) {
                    await tx.user.update({
                        where: { id: pilot.userId },
                        data: { status: expectedStatus, updatedAt: updatedAt },
                    });
                }

                return updatedPilot;

            });

            return {
                message: 'Registration info uploaded successfully.',
                data: updatedPilot,
            };
        } catch (error) {
            throw error;
        }
    }

    async updateNumberPlateInfo(updateNumberPlateDto: UpdateNumberPlateDto) {
        try {
            const { pilotId, numberPlateUrl, regNo } = updateNumberPlateDto;

            const pilot = await this.findUniquePilot(pilotId);

            if (!pilot) {
                throw new NotFoundException('Driver not found');
            }

            if (pilot.isNumberPlateVerified === VerificationStatus.APPROVED) {
                throw new BadRequestException('Number plate already approved');
            }

            const updatedPilot = await this.prisma.$transaction(async (tx) => {
                const updatedAt = new Date();

                const pilotUpdateData: any = {
                    updatedAt: updatedAt,
                };
                if (numberPlateUrl) pilotUpdateData.numberPlateUrl = numberPlateUrl || pilot.numberPlateUrl;

                pilotUpdateData.isNumberPlateVerified =
                    (pilotUpdateData?.numberPlateUrl) ? VerificationStatus.IN_PROGRESS : VerificationStatus.PENDING;


                const updatedPilot = await tx.pilot.update({
                    where: { id: pilotId },
                    data: pilotUpdateData,
                });

                await tx.vehicle.upsert({
                    where: { pilotId },
                    update: {
                        regNo,
                        updatedAt: updatedAt,
                    },
                    create: {
                        regNo,
                        createdAt: updatedAt,
                        colour: null,
                        pilot: { connect: { id: pilotId } },
                    },
                });

                const expectedStatus = this.isAllDocumentsUploaded(updatedPilot)
                    ? UserStatus.IN_REVIEW
                    : UserStatus.ONBOARDING;

                if (pilot.user.status !== expectedStatus) {
                    await tx.user.update({
                        where: { id: pilot.userId },
                        data: { status: expectedStatus, updatedAt: updatedAt },
                    });
                }

                return updatedPilot;

            });
            return {
                message: 'Number plate uploaded successfully.',
                data: updatedPilot,
            };
        } catch (error) {
            throw error;
        }
    }

    async updateTaxTokenInfo(updateTaxTokenDto: UpdateTaxTokenDto) {
        try {
            const { pilotId, taxTokenUrl, ...taxTokenData } = updateTaxTokenDto;

            const pilot = await this.findUniquePilot(pilotId);

            if (!pilot) {
                throw new NotFoundException('Driver not found');
            }

            if (pilot.isTaxTokenVerified === VerificationStatus.APPROVED) {
                throw new BadRequestException('Tax token already approved');
            }

            const updatedPilot = await this.prisma.$transaction(async (tx) => {
                const updatedAt = new Date();

                const pilotUpdateData: any = {
                    updatedAt: updatedAt,
                };
                if (taxTokenUrl) pilotUpdateData.taxTokenUrl = taxTokenUrl || pilot.taxTokenUrl;

                pilotUpdateData.isTaxTokenVerified =
                    (pilotUpdateData?.taxTokenUrl) ? VerificationStatus.IN_PROGRESS : VerificationStatus.PENDING;


                const updatedPilot = await tx.pilot.update({
                    where: { id: pilotId },
                    data: pilotUpdateData,
                });

                await tx.vehicle.upsert({
                    where: { pilotId },
                    update: {
                        ...taxTokenData,
                        updatedAt: updatedAt,
                    },
                    create: {
                        pilotId,
                        ...taxTokenData,
                        createdAt: updatedAt,
                    },
                });

                const expectedStatus = this.isAllDocumentsUploaded(updatedPilot)
                    ? UserStatus.IN_REVIEW
                    : UserStatus.ONBOARDING;

                if (pilot.user.status !== expectedStatus) {
                    await tx.user.update({
                        where: { id: pilot.userId },
                        data: { status: expectedStatus, updatedAt: updatedAt },
                    });
                }

                return updatedPilot;

            });
            return {
                message: 'Tax token uploaded successfully.',
                data: updatedPilot,
            };
        } catch (error) {
            throw error;
        }
    }

    async rejectDocument(rejectDocumentDto: RejectDocumentDto) {
        const { pilotId, documentType, rejectionReason } = rejectDocumentDto;

        const pilot = await this.findUniquePilot(pilotId);

        if (!pilot) {
            throw new NotFoundException('Driver not found');
        }

        if (pilot[this.verificationFieldMap[documentType]] === VerificationStatus.APPROVED) {
            throw new BadRequestException('Document already approved');
        }

        const verificationField = this.verificationFieldMap[documentType];
        const rejectionField = this.rejectionReasonFieldMap[documentType];

        if (!verificationField || !rejectionField) {
            throw new BadRequestException('Unsupported document type');
        }

        const updatedPilot = await this.prisma.$transaction(async (tx) => {
            const updatedPilot = await tx.pilot.update({
                where: { id: pilotId },
                data: {
                    [verificationField]: VerificationStatus.REJECTED,
                    [rejectionField]: rejectionReason,
                    updatedAt: new Date(),
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
            message: 'Document rejected successfully.',
            data: updatedPilot,
        };
    }

    async approveDocument({ pilotId, documentType }: ApproveDocumentDto) {
        const pilot = await this.findUniquePilot(pilotId);
        if (!pilot) {
            throw new NotFoundException('Driver not found');
        }

        const verificationField = this.verificationFieldMap[documentType];
        const rejectionField = this.rejectionReasonFieldMap[documentType];


        if (!verificationField || !rejectionField) {
            throw new BadRequestException('Unsupported document type');
        }

        const currentDocumentStatus = pilot[verificationField];
        if (currentDocumentStatus === VerificationStatus.APPROVED) {
            throw new BadRequestException('Document already approved');
        }

        if (currentDocumentStatus === VerificationStatus.PENDING) {
            throw new BadRequestException('Document is not in review');
        }

        const updatedPilot = await this.prisma.$transaction(async (tx) => {
            const updatedPilot = await tx.pilot.update({
                where: { id: pilotId },
                data: {
                    [verificationField]: VerificationStatus.APPROVED,
                    [rejectionField]: null,
                    updatedAt: new Date(),
                },
            });

            if (this.isAllDocumentsApproved(updatedPilot)) {
                await tx.user.update({
                    where: { id: pilot.userId },
                    data: { status: UserStatus.ACTIVE, updatedAt: new Date() },
                });
            }

            return updatedPilot;
        });

        return {
            message: 'Document approved successfully.',
            data: updatedPilot,
        };
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

    private async isAllDocumentsUploaded(pilot: Pilot) {
        const allDocumentsUploaded = [
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
        return allDocumentsUploaded;
    }

    private isAllDocumentsApproved(pilot: Pilot) {
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
}