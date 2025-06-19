import { randomInt } from 'node:crypto';
import {
  Injectable,
  BadRequestException,
  ForbiddenException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from 'src/core/database/prisma.service';
import { AzureService } from 'src/core/utils/azure.util';
import { VerificationService } from 'src/core/utils/verification.util';
import {
  DrivingLicenseDto,
  VehicleRcDto,
  PancardDto,
  AadhaarNumberDto,
  BeOnlineDto,
  BDLicenseDto,
  BDNidDto,
  BDRCDto,
  NumberPlateDto,
} from './dto/pilot.dto';
import {
  VerificationResponseDL,
  VerificationResponseVehicle,
} from './interfaces/pilot.interface';
import formatDate from 'src/common/functions/formatDate';
import { VerifyAadhaarDto } from './dto/pilot.dto';
import { RedisService } from 'src/core/cache/redis.service';
import { VerifyPhoneDto } from 'src/common/dto/common.dto';
import {
  PilotStatus,
  RideType,
  TransactionStatus,
  TransactionType,
  UserStatus,
  VehicleTypeNameBD,
  VerificationStatus,
} from '@prisma/client';
import { PilotRideResponse } from '../ride/dto/ride.interface';
import moment from 'moment-timezone';
import { RedisKeys } from 'src/core/cache/redis-keys';

@Injectable()
export class PilotService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly azureServicce: AzureService,
    private readonly verificationService: VerificationService,
    private readonly redis: RedisService,
  ) {}

  async getPilot(userId: string) {
    try {
      const user = await this.prisma.user.findUnique({
        where: { id: userId, status: UserStatus.ACTIVE },
      });
      if (!user) {
        throw new NotFoundException('User not found.');
      }

      const data: any = await this.prisma.pilot.findUnique({
        where: { userId },
        include: {
          language: true,
          drivingLicense: true,
          wallet: true,
          activeBooking: true,
          vehicle: {
            include: {
              vehicleTypeBD: true,
            },
          },
        },
      });
      if (!data) {
        throw new NotFoundException('Pilot not found.');
      }

      if (data.wallet) {
        const nowDhaka = moment().tz('Asia/Dhaka');
        const startOfToday = nowDhaka.clone().startOf('day').toDate();
        const endOfToday = nowDhaka.clone().endOf('day').toDate();

        const todayEarnings = await this.prisma.pilotTrips.aggregate({
          _sum: {
            amount: true,
          },
          where: {
            pilotId: data.id,
            date: {
              gte: startOfToday,
              lte: endOfToday,
            },
          },
        });

        data.wallet.balance = data.wallet.balance
          ? Number(data.wallet.balance)
          : 0;
        data.wallet.minusLimit = Number(data.wallet.minusLimit);
        data.wallet.todaysEarning = todayEarnings._sum.amount
          ? Math.ceil(Number(todayEarnings._sum.amount))
          : 0;
        data.wallet.lastTripEarning = data.wallet.lastTripEarning
          ? Math.ceil(Number(data.wallet.lastTripEarning))
          : 0;
      }

      if (data.activeBookingId) {
        const customer = await this.prisma.customer.findUnique({
          where: {
            id: data.activeBooking.customerId,
          },
          select: {
            phone: true,
            name: true,
            averageRating: true,
          },
        });

        const payload: PilotRideResponse = {
          bookingId: data.activeBooking.id,
          fare: Math.ceil(Number(data.activeBooking.fare)),
          customerName: customer.name,
          customerPhone: customer.phone,
          averageRating: customer.averageRating,
          pickupLocation: data.activeBooking.pickupLocation,
          dropLocation: data.activeBooking.dropLocation,
          rideStatus: data.activeBooking.status,
          otherPassengerInfo:
            data.activeBooking.rideType === RideType.OTHERS
              ? { name: data.activeBooking.name }
              : null,
        };

        data.activeBooking = payload;
      }

      return {
        message: 'Pilot fetched successfully.',
        data,
      };
    } catch (error) {
      console.error(error);
      throw error;
    }
  }

  async updatePhone(userId: string) {
    try {
      const pilot = await this.prisma.pilot.findUnique({
        where: {
          userId,
        },
      });
      if (!pilot) {
        throw new NotFoundException('Pilot not found.');
      }

      const otp = randomInt(1000, 10000).toString();
      await this.redis.set(`otp:${userId}`, otp, 300);

      // const requestId = await this.otpService.sendOTP(phone);
      // await this.redis.set(`requestId:${phone}`, requestId, 300);

      return {
        message: 'OTP sent to your phone successfully.',
        data: {
          otp,
        },
      };
    } catch (error) {
      console.error(error);
      throw error;
    }
  }

  async verifyPhone(userId: string, verifyCustomerPhoneDto: VerifyPhoneDto) {
    const { phone, otp } = verifyCustomerPhoneDto;

    try {
      const storedOtp = await this.redis.get(`otp:${userId}`);

      if (!storedOtp || storedOtp !== otp) {
        throw new UnauthorizedException('Invalid or expired OTP.');
      }
      await this.redis.del(`otp:${userId}`);

      const data = await this.prisma.pilot.update({
        where: {
          userId,
        },
        data: {
          phone,
        },
      });

      return {
        message: 'Phone number updated successfully.',
        data,
      };
    } catch (error) {
      console.error(error);
      throw error;
    }
  }

  async processDrivingLicense(file: Express.Multer.File, userId: string) {
    try {
      const pilot = await this.prisma.pilot.findUnique({ where: { userId } });

      if (!pilot) {
        throw new NotFoundException('Pilot not found.');
      }

      if (!file) {
        throw new BadRequestException('No file provided.');
      }

      const buffer = file.buffer;

      // Extract text using Azure OCR
      const lines = await this.getOcrResult(buffer);

      const extractedData = this.parseLicenseData(lines);

      const rawResponse = await this.verificationService.verifyDrivingLicense(
        extractedData.dlNumber,
        extractedData.dateOfBirth,
      );

      const verificationResponse: VerificationResponseDL =
        this.transformResponseDL(rawResponse);

      if (rawResponse.isExpired) {
        return {
          message: 'Transport license is expired.',
          data: {
            ...verificationResponse,
            id: null,
            pilotId: null,
            permanentAddress: null,
            temporaryAddress: null,
            metadata: null,
            createdAt: null,
            updatedAt: null,
          },
        };
      }

      const data = await this.updatePilotDrivingLiceseData(
        verificationResponse,
        pilot.id,
      );

      return {
        message: 'Driving license processed successfully.',
        data,
      };
    } catch (error) {
      console.error(error);
      throw error;
    }
  }

  async processManualDrivingLicense(
    drivingLicenseAndDobDto: DrivingLicenseDto,
    userId: string,
  ) {
    try {
      let { drivingLicenseNumber, dob } = drivingLicenseAndDobDto;

      const pilot = await this.prisma.pilot.findUnique({ where: { userId } });
      if (!pilot) {
        throw new NotFoundException('Pilot not found.');
      }

      drivingLicenseNumber = drivingLicenseNumber.split(' ').join('');
      const rawResponse = await this.verificationService.verifyDrivingLicense(
        drivingLicenseNumber,
        dob,
      );

      const verificationResponse: VerificationResponseDL =
        this.transformResponseDL(rawResponse);

      if (rawResponse.isExpired) {
        return {
          message: 'Driving license is expired.',
          data: {
            ...verificationResponse,
            id: null,
            pilotId: null,
            permanentAddress: null,
            temporaryAddress: null,
            metadata: null,
            createdAt: null,
            updatedAt: null,
          },
        };
      }

      const data = await this.updatePilotDrivingLiceseData(
        verificationResponse,
        pilot.id,
      );

      return {
        message: 'Driving license processed successfully.',
        data,
      };
    } catch (error) {
      console.error(error);
      throw error;
    }
  }

  async uploadLiveSelfie(file: Express.Multer.File, userId: string) {
    try {
      const pilot = await this.prisma.pilot.findUnique({ where: { userId } });

      if (!pilot) {
        throw new NotFoundException('Pilot not found.');
      }

      if (
        pilot.selfieUrl &&
        pilot.isSelfieVerified === VerificationStatus.APPROVED
      ) {
        throw new ForbiddenException('Live selfie can be uploaded only once.');
      }

      const fileUrl = file.azureFileUrl;

      if (fileUrl) {
        await this.prisma.pilot.update({
          where: { userId },
          data: {
            selfieUrl: fileUrl,
            isSelfieVerified: VerificationStatus.IN_PROGRESS,
          },
        });
      }

      return { message: 'Live selfie uploaded successfully.' };
    } catch (error) {
      console.error(error);
      throw error;
    }
  }

  async processVehicleRC(file: Express.Multer.File, userId: string) {
    try {
      const pilot = await this.prisma.pilot.findUnique({ where: { userId } });
      if (!pilot) {
        throw new NotFoundException('Pilot not found.');
      }
      if (!pilot.selfieUrl) {
        throw new BadRequestException('Driver does not have Live selfie.');
      }

      if (!file) {
        throw new BadRequestException('No file provided.');
      }
      const buffer = file.buffer;

      // Extract text using Azure OCR
      const lines = await this.getOcrResult(buffer);

      const registrationNumber = this.parseRegistrationNumber(lines);

      if (!registrationNumber) {
        throw new BadRequestException(
          'Could not extract vehicle registration number from the image',
        );
      }

      const verificationResponse: VerificationResponseVehicle =
        await this.verificationService.verifyVehicleRC(registrationNumber);

      if (!verificationResponse.verificationFailed) {
        return {
          message: 'Vehicle registration or permit is expired.',
        };
      }

      const data = await this.updatePilotVehicleData(
        verificationResponse,
        pilot.id,
      );

      return {
        message: 'Vehicle RC processed successfully.',
        data,
      };
    } catch (error) {
      console.error(error);
      throw error;
    }
  }

  async processManualVehicleRC(vehicleRcDto: VehicleRcDto, userId: string) {
    try {
      const pilot = await this.prisma.pilot.findUnique({ where: { userId } });
      if (!pilot) {
        throw new BadRequestException('Pilot not found.');
      }
      if (!pilot.selfieUrl) {
        throw new BadRequestException('Driver does not have Live selfie.');
      }

      let { registrationNumber } = vehicleRcDto;

      registrationNumber = registrationNumber.split(' ').join('');

      const verificationResponse: VerificationResponseVehicle =
        await this.verificationService.verifyVehicleRC(registrationNumber);

      const data = await this.updatePilotVehicleData(
        verificationResponse,
        pilot.id,
      );

      return {
        message: 'Vehicle RC processed successfully.',
        data,
      };
    } catch (error) {
      console.error(error);
      throw error;
    }
  }

  async processPancard(file: Express.Multer.File, userId: string) {
    try {
      const pilot = await this.prisma.pilot.findUnique({ where: { userId } });
      if (!pilot) {
        throw new BadRequestException('Pilot not found.');
      }
      if (pilot.isRCVerified !== VerificationStatus.APPROVED) {
        throw new BadRequestException('Driver does not have rc verfied.');
      }

      if (!file) {
        throw new BadRequestException('No file provided.');
      }

      const buffer = file.buffer;

      // Extract text using Azure OCR
      const lines = await this.getOcrResult(buffer);

      const panNumber = this.parsePancardData(lines);

      if (!panNumber) {
        throw new BadRequestException(
          'Could not extract pan card number from the image.',
        );
      }

      const verificationResponse =
        await this.verificationService.verifyPancard(panNumber);

      if (verificationResponse.panStatus.toLowerCase() !== 'valid') {
        throw new BadRequestException(
          'This pan card is either non-existing or invalid.',
        );
      }

      // await this.verifyPancardName(verificationResponse, userId);

      const data = await this.prisma.pilot.update({
        where: { userId },
        data: {
          isPanCardVerified: VerificationStatus.APPROVED,
          panCardNumber: verificationResponse.number,
          panCardName: verificationResponse.name,
        },
      });

      return {
        message: 'Pancard verified successfully.',
        data,
      };
    } catch (error) {
      console.error(error);
      throw error;
    }
  }

  async processManualPancard(pancardDto: PancardDto, userId: string) {
    try {
      const pilot = await this.prisma.pilot.findUnique({ where: { userId } });
      if (!pilot) {
        throw new BadRequestException('Pilot not found.');
      }
      if (pilot.isRCVerified !== VerificationStatus.APPROVED) {
        throw new BadRequestException('Driver does not have rc verfied.');
      }

      const { panNumber } = pancardDto;

      const verificationResponse =
        await this.verificationService.verifyPancard(panNumber);

      if (verificationResponse.panStatus.toLowerCase() !== 'valid') {
        throw new BadRequestException(
          'This pan card is either non-existing or invalid.',
        );
      }

      // await this.verifyPancardName(verificationResponse, userId);

      const data = await this.prisma.pilot.update({
        where: { userId },
        data: {
          isPanCardVerified: VerificationStatus.APPROVED,
          panCardNumber: verificationResponse.number,
          panCardName: verificationResponse.name,
        },
      });

      return {
        message: 'Pancard verified successfully.',
        data,
      };
    } catch (error) {
      console.error(error);
      throw error;
    }
  }

  async processAadhaar(file: Express.Multer.File, userId: string) {
    try {
      const pilot = await this.prisma.pilot.findUnique({ where: { userId } });
      if (!pilot) {
        throw new NotFoundException('Pilot not found.');
      }
      if (pilot.isPanCardVerified !== VerificationStatus.APPROVED) {
        throw new BadRequestException('Driver does not have pancard verfied.');
      }

      if (!file) {
        throw new BadRequestException('No file provided.');
      }

      const buffer = file.buffer;

      const lines = await this.getOcrResult(buffer);

      const aadhaarNumber = this.parseAadhaarData(lines);
      if (!aadhaarNumber) {
        throw new BadRequestException(
          'Could not extract aadhaar number from the image',
        );
      }

      const verificationResponse =
        await this.verificationService.sendOtpToverifyAadhaar(aadhaarNumber);

      return {
        message: 'OTP for Aadhaar verification sent successfully',
        data: {
          ref_id: verificationResponse.ref_id,
        },
      };
    } catch (error) {
      console.error(error);
      throw error;
    }
  }

  async processAadhaarManual(
    aadhaarNumberDto: AadhaarNumberDto,
    userId: string,
  ) {
    const { aadhaarNumber } = aadhaarNumberDto;

    try {
      const pilot = await this.prisma.pilot.findUnique({ where: { userId } });
      if (!pilot) {
        throw new NotFoundException('Pilot not found.');
      }
      if (pilot.isPanCardVerified !== VerificationStatus.APPROVED) {
        throw new BadRequestException('Driver does not have pancard verfied.');
      }

      const verificationResponse =
        await this.verificationService.sendOtpToverifyAadhaar(aadhaarNumber);

      return {
        message: 'OTP for Aadhaar verification sent successfully',
        data: {
          ref_id: verificationResponse.ref_id,
        },
      };
    } catch (error) {
      console.error(error);
      throw error;
    }
  }

  async verifyAadhaar(aadhaarNumberDto: VerifyAadhaarDto, userId: string) {
    const { ref_id, otp, aadhaarNumber: aadhaarCardNumber } = aadhaarNumberDto;

    try {
      const verificationResponse = await this.verificationService.verifyAadhaar(
        ref_id,
        otp,
      );

      if (verificationResponse.status.toLowerCase() !== 'valid') {
        throw new BadRequestException(
          'This aadhaar is either non-existing or invalid.',
        );
      }

      const { name: aadhaarName, address: aadhaarCardAddress } =
        verificationResponse;

      const data = await this.prisma.pilot.update({
        where: { userId },
        data: {
          isAadhaarVerified: VerificationStatus.APPROVED,
          aadhaarCardNumber,
          aadhaarName,
          aadhaarCardAddress,
        },
      });

      return {
        message: 'Aadhaar verified successfully.',
        data,
      };
    } catch (error) {
      console.error(error);
      throw error;
    }
  }

  async onboardingOffer(userId: string) {
    try {
      const pilot = await this.prisma.pilot.findUnique({ where: { userId } });
      if (
        pilot.isDLVerified !== VerificationStatus.APPROVED ||
        pilot.isRCVerified !== VerificationStatus.APPROVED
      ) {
        throw new BadRequestException('Driving License or RC is not verfied.');
      }

      const subscription = await this.prisma.subscription.findUnique({
        where: { name: 'Flexi Pack' },
      });

      const wallet = await this.prisma.pilotWallet.create({
        data: {
          pilotId: pilot.id,
          balance: subscription.coins,
          subscriptionId: subscription.id,
        },
      });

      await this.prisma.transaction.create({
        data: {
          pilotId: pilot.id,
          amount: 0,
          walletId: wallet.id,
          type: TransactionType.ONBOARDING_OFFER,
          status: TransactionStatus.SUCCESSFUL,
        },
      });

      await this.prisma.pilot.update({
        where: { userId },
        data: {
          isFairCoinAvailed: true,
        },
      });

      return {
        message: 'Pilot onboarding coins availed successfully.',
      };
    } catch (error) {
      console.error(error);
      throw error;
    }
  }

  async getVehicles(userId: string) {
    try {
      const pilot = await this.prisma.pilot.findUnique({ where: { userId } });
      if (!pilot) {
        throw new NotFoundException('Pilot not found.');
      }

      const data = await this.prisma.vehicle.findMany({
        where: { pilotId: pilot.id },
        include: {
          vehicleTypeBD: true,
        },
      });

      return {
        message: 'Vehicles fetched successfully.',
        data,
      };
    } catch (error) {
      console.error(error);
      throw error;
    }
  }

  async getTransactions(
    userId: string,
    startDate: string,
    endDate: string,
    page: number = 1,
    pageSize: number = 10,
  ) {
    try {
      const pilot = await this.prisma.pilot.findUnique({ where: { userId } });
      if (!pilot) {
        throw new NotFoundException('Pilot not found.');
      }

      const start = moment.utc(startDate);
      const end = moment.utc(endDate);

      if (!start.isValid() || !end.isValid()) {
        throw new BadRequestException('Invalid start or end date.');
      }
      if (start.isAfter(end)) {
        throw new BadRequestException('startDate must be before endDate');
      }

      const whereClause = {
        pilotId: pilot.id,
        type: TransactionType.SUBSCRIPTION_PURCHASE,
        createdAt: {
          gte: start.toDate(),
          lte: end.toDate(),
        },
      };

      const skip = (page - 1) * pageSize;

      // Get the total count for pagination metadata
      const totalCount = await this.prisma.transaction.count({
        where: whereClause,
      });

      // Get the paginated data
      const data: any = await this.prisma.transaction.findMany({
        where: whereClause,
        include: {
          subscription: true,
        },
        orderBy: {
          createdAt: 'desc',
        },
        skip,
        take: pageSize,
      });

      // Process the Decimal fields
      data.forEach((transaction: any) => {
        transaction.amount = Number(transaction.amount);
        transaction.balanceBefore = Number(transaction.balanceBefore);
        transaction.balanceAfter = Number(transaction.balanceAfter);
      });

      // Calculate pagination metadata
      const totalPages = Math.ceil(totalCount / pageSize);
      const hasNextPage = page < totalPages;
      const hasPrevPage = page > 1;

      return {
        message: 'Transactions fetched successfully.',
        data: {
          transactions: data,
          pagination: {
            totalItems: totalCount,
            totalPages,
            currentPage: page,
            pageSize,
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

  async beOnline(userId: string, beOnlineDto: BeOnlineDto) {
    const { onlineStatus, currentLocation } = beOnlineDto;

    try {
      const pilot = await this.prisma.pilot.findUnique({
        where: { userId },
        select: {
          userId: true,
          isRCVerified: true,
          isDLVerified: true,
          isNidVerified: true,
        },
      });
      if (!pilot) {
        throw new NotFoundException('Pilot not found.');
      }

      if (
        pilot.isRCVerified !== VerificationStatus.APPROVED ||
        pilot.isDLVerified !== VerificationStatus.APPROVED ||
        pilot.isNidVerified !== VerificationStatus.APPROVED
      ) {
        throw new BadRequestException('RC, DL or NID is not verfied.');
      }

      if (onlineStatus) {
        await this.redis.geoAdd(
          RedisKeys.PILOT_LOCATION,
          Number(currentLocation.lat),
          Number(currentLocation.lng),
          pilot.userId,
        );
      }

      if (!onlineStatus) {
        await this.redis.zRem(RedisKeys.PILOT_LOCATION, pilot.userId);
      }

      await this.prisma.pilot.update({
        where: { userId },
        data: {
          onlineStatus: onlineStatus
            ? PilotStatus.AVAILABLE
            : PilotStatus.OFFLINE,
          currentLocation: JSON.parse(JSON.stringify(currentLocation)),
        },
      });
    } catch (error) {
      console.error(error);
      throw error;
    }
  }

  async uploadBDLicense(
    files: { front: Express.Multer.File[]; back?: Express.Multer.File[] },
    userId: string,
  ) {
    try {
      const pilot = await this.prisma.pilot.findUnique({ where: { userId } });
      if (!pilot) {
        throw new NotFoundException('Pilot not found.');
      }
      if (pilot.isDLVerified === VerificationStatus.APPROVED) {
        throw new BadRequestException(
          'Pilot already verified Driving License.',
        );
      }

      const frontSideBuffer = files.front[0].buffer;
      const frontSideUrl = await this.azureServicce.uploadFile(
        frontSideBuffer,
        files.front[0].originalname,
        userId,
        files.front[0].mimetype,
      );

      let backSideUrl = null;
      if (files.back) {
        const backSideBuffer = files.back[0].buffer;
        backSideUrl = await this.azureServicce.uploadFile(
          backSideBuffer,
          files.back[0].originalname,
          userId,
          files.back[0].mimetype,
        );
      }

      const updateData: any = {
        dlFrontSideUrl: frontSideUrl,
      };

      if (backSideUrl) {
        updateData.dlBackSideUrl = backSideUrl;
      }

      // Update pilot with URLs
      await this.prisma.pilot.update({
        where: { userId },
        data: updateData,
      });

      let verificationResponse =
        await this.verificationService.extractDLData(frontSideBuffer);

      if (!verificationResponse) {
        throw new BadRequestException(
          'Failed to extract driving license data.',
        );
      }

      if (
        !verificationResponse.licenseNumber &&
        !verificationResponse.dateOfBirth &&
        !verificationResponse.licenseExpiryDate
      ) {
        throw new BadRequestException(
          'This driving license is either non-existing or invalid.',
        );
      }

      const formattedDateOfBirth = moment(
        verificationResponse?.dateOfBirth,
        'DD MMM YYYY',
      )
        .startOf('day')
        .toISOString();
      const formattedLicenseExpiryDate = moment(
        verificationResponse?.licenseExpiryDate,
        'DD MMM YYYY',
      )
        .startOf('day')
        .toISOString();

      verificationResponse = {
        ...verificationResponse,
        dateOfBirth: formattedDateOfBirth,
        licenseExpiryDate: formattedLicenseExpiryDate,
      };

      return {
        message: 'Driving license data extracted successfully.',
        data: verificationResponse,
      };
    } catch (error) {
      console.error(error);
      throw error;
    }
  }

  async processBDLicense(bDLicenseDto: BDLicenseDto, userId: string) {
    const { dlNumber, name, dob, expiryDate } = bDLicenseDto;

    try {
      const pilot = await this.prisma.pilot.findUnique({
        where: { userId },
        include: { drivingLicense: true },
      });
      if (!pilot) {
        throw new NotFoundException('Pilot not found.');
      }
      if (pilot.isDLVerified === VerificationStatus.APPROVED) {
        throw new BadRequestException(
          'Pilot already verified Driving License.',
        );
      }

      const data = await this.prisma.drivingLicense.upsert({
        where: { pilotId: pilot.id },
        update: {
          licenseNumber: dlNumber,
          dateOfBirth: dob,
          validUntill: expiryDate,
          nameOnLicense: name,
        },
        create: {
          licenseNumber: dlNumber,
          dateOfBirth: dob,
          validUntill: expiryDate,
          nameOnLicense: name,
          pilotId: pilot.id,
        },
      });

      await this.prisma.pilot.update({
        where: { userId },
        data: {
          isDLVerified: VerificationStatus.IN_PROGRESS,
        },
      });

      const transformedData = {
        name: data.nameOnLicense,
        dateOfBirth: data.dateOfBirth,
        licenseNumber: data.licenseNumber,
        licenseExpiryDate: data.validUntill,
      };

      return {
        message: 'Driving license data added successfully.',
        data: transformedData,
      };
    } catch (error) {
      console.error(error);
      throw error;
    }
  }

  async uploadBDNid(
    files: { front: Express.Multer.File[]; back: Express.Multer.File[] },
    userId: string,
  ) {
    try {
      const pilot = await this.prisma.pilot.findUnique({
        where: { userId },
        include: { nid: true },
      });
      if (!pilot) {
        throw new NotFoundException('Pilot not found.');
      }
      if (pilot.isNidVerified === VerificationStatus.APPROVED) {
        throw new BadRequestException('Pilot already verified NID.');
      }

      const frontSideBuffer = files.front[0].buffer;
      const backSideBuffer = files.back[0].buffer;

      const frontSideUrl = await this.azureServicce.uploadFile(
        frontSideBuffer,
        files.front[0].originalname,
        userId,
        files.front[0].mimetype,
      );

      const backSideUrl = await this.azureServicce.uploadFile(
        backSideBuffer,
        files.back[0].originalname,
        userId,
        files.back[0].mimetype,
      );

      if (frontSideUrl && backSideUrl) {
        await this.prisma.pilot.update({
          where: { userId },
          data: {
            nidFrontSideUrl: frontSideUrl,
            nidBackSideUrl: backSideUrl,
          },
        });
      }

      const verificationResponse =
        await this.verificationService.extractNidData(frontSideBuffer);

      if (!verificationResponse) {
        throw new BadRequestException('Failed to extract NID data.');
      }

      if (
        !verificationResponse.nidNumber &&
        !verificationResponse.name &&
        !verificationResponse.dateOfBirth
      ) {
        throw new BadRequestException(
          'This NID card is either non-existing or invalid.',
        );
      }

      const formattedDateOfBirth = moment(
        verificationResponse?.dateOfBirth,
        'DD MMM YYYY',
      )
        .startOf('day')
        .toISOString();

      return {
        message: 'NID data extracted successfully.',
        data: {
          dateOfBirth: formattedDateOfBirth,
          nidNumber: verificationResponse.nidNumber,
          name: verificationResponse.name,
        },
      };
    } catch (error) {
      console.error(error);
      throw error;
    }
  }

  async processBDNid(bDNidDto: BDNidDto, userId: string) {
    const { nidNumber, name, dateOfBirth } = bDNidDto;

    try {
      const pilot = await this.prisma.pilot.findUnique({ where: { userId } });
      if (!pilot) {
        throw new NotFoundException('Pilot not found.');
      }
      if (pilot.isNidVerified === VerificationStatus.APPROVED) {
        throw new BadRequestException('Pilot already verified NID.');
      }

      const data = await this.prisma.nid.upsert({
        where: { pilotId: pilot.id },
        update: {
          nidNumber,
          name,
          dateOfBirth,
        },
        create: {
          nidNumber,
          name,
          dateOfBirth,
          pilotId: pilot.id,
        },
      });

      await this.prisma.pilot.update({
        where: { userId },
        data: {
          isNidVerified: VerificationStatus.IN_PROGRESS,
        },
      });

      const transformedData = {
        dateOfBirth: data.dateOfBirth,
        nidNumber: data.nidNumber,
        name: data.name,
      };

      return {
        message: 'NID data added successfully.',
        data: transformedData,
      };
    } catch (error) {
      console.error(error);
      throw error;
    }
  }

  async uploadBDRC(
    files: { front: Express.Multer.File[]; back: Express.Multer.File[] },
    userId: string,
  ) {
    try {
      const pilot = await this.prisma.pilot.findUnique({ where: { userId } });
      if (!pilot) {
        throw new NotFoundException('Pilot not found.');
      }
      if (pilot.isRCVerified === VerificationStatus.APPROVED) {
        throw new BadRequestException('Pilot already verified RC.');
      }

      const frontSideBuffer = files.front[0].buffer;
      const backSideBuffer = files.back[0].buffer;

      const frontSideUrl = await this.azureServicce.uploadFile(
        frontSideBuffer,
        files.front[0].originalname,
        userId,
        files.front[0].mimetype,
      );

      const backSideUrl = await this.azureServicce.uploadFile(
        backSideBuffer,
        files.back[0].originalname,
        userId,
        files.back[0].mimetype,
      );

      if (frontSideUrl && backSideUrl) {
        await this.prisma.pilot.update({
          where: { userId },
          data: {
            rcFrontSideUrl: frontSideUrl,
            rcBackSideUrl: backSideUrl,
          },
        });
      }

      let verificationResponse =
        await this.verificationService.extractRCData(frontSideBuffer);

      if (!verificationResponse) {
        throw new BadRequestException('Failed to extract RC data.');
      }

      if (
        !verificationResponse.vehicleNumber &&
        !verificationResponse.vehicleType &&
        !verificationResponse.registrationDate &&
        !verificationResponse.vehicleColour
      ) {
        throw new BadRequestException(
          'This RC card is either non-existing or invalid.',
        );
      }

      const formattedRegistrationDate = moment(
        verificationResponse?.registrationDate,
        'DD MMM YYYY',
      )
        .startOf('day')
        .toISOString();

      verificationResponse = {
        ...verificationResponse,
        registrationDate: formattedRegistrationDate,
      };

      return {
        message: 'RC data extracted successfully.',
        data: verificationResponse,
      };
    } catch (error) {
      console.error(error);
      throw error;
    }
  }

  async processBDRC(bDRCDto: BDRCDto, userId: string) {
    const { vehicleNumber, vehicleType, registrationDate, vehicleColour } =
      bDRCDto;

    try {
      const pilot = await this.prisma.pilot.findUnique({ where: { userId } });
      if (!pilot) {
        throw new NotFoundException('Pilot not found.');
      }
      console.log('pilot.isRCVerified', pilot.isRCVerified);
      if (pilot.isRCVerified === VerificationStatus.APPROVED) {
        throw new BadRequestException('Pilot already verified RC.');
      }

      await this.prisma.pilot.update({
        where: { userId },
        data: {
          isRCVerified: VerificationStatus.IN_PROGRESS,
        },
      });

      const vehicleTypeBD = await this.prisma.vehicleTypeBD.findFirst({
        where: {
          name: vehicleType as VehicleTypeNameBD,
        },
      });

      if (!vehicleTypeBD) {
        throw new BadRequestException('Invalid vehicle type');
      }

      const data = await this.prisma.vehicle.upsert({
        where: { pilotId: pilot.id },
        create: {
          regNo: vehicleNumber,
          registrationDate,
          colour: vehicleColour,
          model: vehicleType,
          pilotId: pilot.id,
          vehicleTypeIdBD: vehicleTypeBD.id,
        },
        update: {
          regNo: vehicleNumber,
          registrationDate,
          colour: vehicleColour,
          model: vehicleType,
          pilotId: pilot.id,
          vehicleTypeIdBD: vehicleTypeBD.id,
        },
      });

      const transformedData = {
        vehicleNumber: data.regNo,
        vehicleType: data.model,
        registrationDate: data.registrationDate,
        vehicleColour: data.colour,
      };

      return {
        message: 'RC data added successfully.',
        data: transformedData,
      };
    } catch (error) {
      console.error(error);
      throw error;
    }
  }

  async uploadNumberPlate(file: Express.Multer.File, userId: string) {
    try {
      const pilot = await this.prisma.pilot.findUnique({ where: { userId } });
      if (!pilot) {
        throw new NotFoundException('Pilot not found.');
      }
      if (pilot.isNumberPlateVerified === VerificationStatus.APPROVED) {
        throw new BadRequestException('Pilot already verified number plate.');
      }

      const numberPlateBuffer = file.buffer;

      const numberPlateUrl = await this.azureServicce.uploadFile(
        numberPlateBuffer,
        file.originalname,
        userId,
        file.mimetype,
      );

      await this.prisma.pilot.update({
        where: { userId },
        data: {
          numberPlateUrl,
        },
      });

      const verificationResponse =
        await this.verificationService.extractNumberPlateData(
          numberPlateBuffer,
        );

      if (!verificationResponse) {
        throw new BadRequestException('Failed to extract number plate data.');
      }

      if (!verificationResponse.numberPlate) {
        throw new BadRequestException(
          'Number plate is not valid or not readable.',
        );
      }

      return {
        message: 'Number plate uploaded successfully.',
        data: {
          numberPlate: verificationResponse.numberPlate,
        },
      };
    } catch (error) {
      console.error(error);
      throw error;
    }
  }

  async processNumberPlate(numberPlateDto: NumberPlateDto, userId: string) {
    const { numberPlate } = numberPlateDto;

    try {
      const pilot = await this.prisma.pilot.findUnique({ where: { userId } });
      if (!pilot) {
        throw new NotFoundException('Pilot not found.');
      }
      if (pilot.isNumberPlateVerified === VerificationStatus.APPROVED) {
        throw new BadRequestException('Pilot already verified number plate.');
      }

      const vehicle = await this.prisma.vehicle.findFirst({
        where: { pilotId: pilot.id },
        select: {
          regNo: true,
        },
      });
      if (!vehicle) {
        throw new BadRequestException('Vehicle not found.');
      }

      // if (!vehicle.regNo.includes(numberPlate)) {
      //   throw new BadRequestException(
      //     'Number plate does not match with vehicle registration number.',
      //   );
      // }

      await this.prisma.pilot.update({
        where: { userId },
        data: {
          isNumberPlateVerified: VerificationStatus.IN_PROGRESS,
        },
      });

      return {
        message: 'Number plate added successfully.',
        data: {
          numberPlate,
        },
      };
    } catch (error) {
      console.error(error);
      throw error;
    }
  }

  private async getOcrResult(buffer: any) {
    const ocrResult = await this.azureServicce.extractTextFromImage(buffer);

    if (!ocrResult?.analyzeResult?.readResults?.[0]?.lines) {
      throw new BadRequestException('Unable to process the image.');
    }

    return ocrResult.analyzeResult.readResults[0].lines;
  }

  private parseLicenseData(lines: any[]) {
    const data = {
      dlNumber: '',
      dateOfBirth: '',
    };

    for (const line of lines) {
      const text = line.text.trim();

      // Extract Driving License Number (DL No)
      if (text.startsWith('DL No')) {
        // DL No : MH01 19950048097
        data.dlNumber = text.substring(text.indexOf(':') + 2);
      }

      // Extract Date of Birth (DOB)
      if (text.startsWith('DOB')) {
        // text: "DOB : 01-12-1987"
        data.dateOfBirth = text.substring(text.indexOf(':') + 2);
      }
    }

    data.dlNumber = data.dlNumber.split(' ').join('');

    return data;
  }

  private transformResponseDL(rawResponse: any) {
    return {
      licenseNumber: rawResponse.dlNumber,
      dateOfBirth: formatDate(rawResponse.dob),
      nameOnLicense: rawResponse.detailsOfDrivingLicence.name,
      dateOfIssue: formatDate(rawResponse.detailsOfDrivingLicence.dateOfIssue),
      validUntill: formatDate(rawResponse.dlValidity.transport.to),
    };
  }

  private async updatePilotDrivingLiceseData(
    verificationResponse: VerificationResponseDL,
    pilotId: string,
  ) {
    const {
      licenseNumber,
      nameOnLicense,
      dateOfIssue,
      validUntill,
      dateOfBirth,
    } = verificationResponse;

    // Create Driving License record in the database
    const drivingLicense = await this.prisma.drivingLicense.create({
      data: {
        licenseNumber,
        nameOnLicense,
        dateOfIssue,
        validUntill,
        dateOfBirth,
        pilotId,
      },
    });

    await this.prisma.pilot.update({
      where: { id: pilotId },
      data: {
        isDLVerified: VerificationStatus.APPROVED,
      },
    });

    return drivingLicense;
  }

  private parseRegistrationNumber(lines: any[]): string | null {
    for (const line of lines) {
      const text = line.text.trim();

      // Look for the registration number line
      if (text.startsWith('Regn. No.')) {
        // Split the text and get the last part which should be the registration number
        const parts = text.split(' ');
        return parts[parts.length - 1];
      }
    }
    return null;
  }

  // private isVehicleRegistrationNumberExpired(rcExpiryDate) {
  //   const expiryDateUTC = moment.utc(rcExpiryDate);
  //   const nowUTC = moment.utc();
  //   const expiryDateIST = expiryDateUTC.tz('Asia/Kolkata');
  //   const nowIST = nowUTC.tz('Asia/Kolkata');
  //   if (expiryDateIST.isBefore(nowIST)) {
  //     return true;
  //   }
  //   return false;
  // }

  private parsePancardData(lines: any[]) {
    const panIdentifiers = [
      'Permanent Account Number Card',
      'Permanent Account Number',
    ];

    let foundPanTitle = false;

    for (const line of lines) {
      const text = line.text.trim();

      if (panIdentifiers.includes(text)) {
        foundPanTitle = true;
        continue;
      }

      if (foundPanTitle) {
        return text;
      }
    }
  }

  private parseAadhaarData(lines: any[]): string | null {
    for (const line of lines) {
      const text = line.text.trim();

      const aadhaarRegex = /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g;
      const match = text.match(aadhaarRegex);

      // Add a check to see if the match is null
      if (match && match[0]) {
        const cleanedNumber = match[0].replace(/[\s-]/g, '');

        if (cleanedNumber.length === 12) {
          return cleanedNumber;
        }
      }
    }

    return null;
  }

  private async updatePilotVehicleData(
    verificationResponse: VerificationResponseVehicle,
    pilotId: string,
  ) {
    const {
      category,
      regNo,
      regUpto,
      permitUpto,
      status,
      insuranceUpto,
      manufacturer,
      model,
      colour,
      seatCapacity,
      fitUpto,
      puccUpto,
      state,
    } = verificationResponse;

    const vehicleCategory = await this.prisma.vehicleTypeBD.findFirst({
      where: {
        name: category as VehicleTypeNameBD,
      },
    });

    const vehicle = await this.prisma.vehicle.create({
      data: {
        regNo,
        regUpto,
        permitUpto,
        status,
        fitUpto,
        puccUpto,
        insuranceUpto,
        model,
        colour,
        seatCapacity,
        manufacturer,
        state,
        pilot: {
          connect: { id: pilotId },
        },
        vehicleTypeBD: {
          connect: { id: vehicleCategory.id },
        },
      },
    });

    // Update pilot record with vehicle information
    await this.prisma.pilot.update({
      where: { id: pilotId },
      data: {
        isRCVerified: VerificationStatus.APPROVED,
      },
    });

    return vehicle;
  }

  private async verifyPancardName(verificationResponse: any, userId: string) {
    const name =
      verificationResponse.firstName + ' ' + verificationResponse.lastName;

    // Check if pan card name matches with driving license name
    const pilot = await this.prisma.pilot.findUnique({ where: { userId } });
    const drivingLicense = await this.prisma.drivingLicense.findUnique({
      where: { pilotId: pilot.id },
    });

    if (drivingLicense.nameOnLicense !== name) {
      throw new BadRequestException(
        'Pancard name does not match with driving license name.',
      );
    }
  }
}
