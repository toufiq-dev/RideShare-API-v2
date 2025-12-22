import { randomInt } from 'node:crypto';
import {
  Injectable,
  BadRequestException,
  ForbiddenException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from 'src/core/database/database.service';
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
  FreeRechargeDto,
  BDNidType,
  UpdateDriverDetailsDto,
  UpdatePilotPhoneDto,
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
  Country,
  PilotStatus,
  RideType,
  TransactionStatus,
  TransactionType,
  UserRole,
  UserStatus,
  VehicleTypeNameBD,
  VerificationStatus,
} from '@prisma/client';
import { PilotRideResponse } from '../ride/dto/ride.interface';
import moment from 'moment-timezone';
import { RedisKeys } from 'src/core/cache/redis-keys';
import { ConfigService } from '@nestjs/config';
import { TelemetryService } from '../pricing/telemetry.service';
import { h3Cell } from 'src/core/utils/h3.util';
import { OTPService } from 'src/core/utils/otp.util';

@Injectable()
export class PilotService {
  private readonly flexiPack: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly azureService: AzureService,
    private readonly verificationService: VerificationService,
    private readonly redis: RedisService,
    private readonly configService: ConfigService,
    private readonly telemetryService: TelemetryService,
    private readonly otpService: OTPService,
  ) {
    this.flexiPack = this.configService.get<string>('subscription.flexiPack');
  }

  async getPilot(userId: string) {
    try {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: {
          status: true,
        },
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
          pilotType: data.pilotType,
          bookingId: data.activeBooking.id,
          fare: Math.ceil(Number(data.activeBooking.discountedFare)),
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

      data.totalLifetimeEarnings = Number(data.totalLifetimeEarnings);
      data.status = user.status;

      return {
        message: 'Pilot fetched successfully.',
        data,
      };
    } catch (error) {
      console.error(error);
      throw error;
    }
  }

  async updatePhone(userId: string, updatePilotPhoneDto: UpdatePilotPhoneDto) {
    const { phone } = updatePilotPhoneDto;

    try {
      const pilot = await this.prisma.pilot.findUnique({
        where: {
          userId,
        },
      });
      if (!pilot) {
        throw new NotFoundException('Pilot not found.');
      }

      // Determine country code
      let countryCode: Country | null = null;
      if (phone.startsWith('+880')) {
        countryCode = Country.BD;
      } else if (phone.startsWith('+91')) {
        countryCode = Country.IN;
      } else {
        throw new BadRequestException('Invalid phone number format.');
      }

      // Check if OTP was already sent recently
      const otpSent = await this.redis.get(`otpSent:${phone}`);
      if (otpSent) {
        throw new BadRequestException(
          'OTP already sent. Please wait for 1 minute.',
        );
      }

      const otp = randomInt(1000, 10000).toString();
      await this.redis.set(`otp:${userId}`, otp, 300);

      // Send OTP based on country
      if (countryCode === Country.BD) {
        const isSent = await this.otpService.sendOTPBD(phone, otp);
        if (!isSent) {
          throw new BadRequestException('Failed to send OTP.');
        }
        console.warn(`OTP ${otp} sent to the phone ${phone} successfully.`);
        await this.redis.set(`otpSent:${phone}`, 'true', 60);

        return {
          message: 'OTP sent to your phone successfully.',
          data: {
            otp: ' ',
          },
        };
      } else if (countryCode === Country.IN) {
        const requestId = await this.otpService.sendOTP(phone);
        await this.redis.set(`requestId:${phone}`, requestId, 300);

        return {
          message: 'OTP sent to your phone successfully.',
          data: {
            otp: ' ',
          },
        };
      }
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

  async uploadLiveSelfie(
    file: Express.Multer.File,
    userId: string,
    role: UserRole,
  ) {
    try {
      let pilot = null;
      if (role === UserRole.PILOT) {
        pilot = await this.prisma.pilot.findUnique({ where: { userId } });
      } else {
        pilot = await this.prisma.pilot.findUnique({ where: { id: userId } });
      }

      if (!pilot) {
        throw new NotFoundException('Pilot not found.');
      }

      if (
        role === UserRole.PILOT &&
        pilot.selfieUrl &&
        pilot.isSelfieVerified === VerificationStatus.APPROVED
      ) {
        throw new ForbiddenException('Live selfie can be uploaded only once.');
      }

      const fileUrl = file.azureFileUrl;

      if (fileUrl) {
        await this.prisma.$transaction(async (tx) => {
          await tx.pilot.update({
            where: { id: pilot.id },
            data: {
              selfieUrl: fileUrl,
              isSelfieVerified: VerificationStatus.IN_PROGRESS,
            },
          });

          await tx.user.update({
            where: { id: pilot.userId },
            data: { status: UserStatus.ONBOARDING },
          });
        });
      }

      return {
        message: 'Live selfie uploaded successfully.',
        data: pilot.selfieUrl,
      };
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
        throw new BadRequestException(
          'Your Driving License or RC is not verfied.',
        );
      }

      const subscription = await this.prisma.subscription.findUnique({
        where: { name: this.flexiPack },
      });

      await this.prisma.$transaction(async (tx) => {
        const wallet = await tx.pilotWallet.create({
          data: {
            pilotId: pilot.id,
            balance: subscription.coins,
            subscriptionId: subscription.id,
          },
        });

        await tx.transaction.create({
          data: {
            pilotId: pilot.id,
            amount: 0,
            walletId: wallet.id,
            type: TransactionType.ONBOARDING_OFFER,
            status: TransactionStatus.SUCCESSFUL,
            balanceBefore: 0,
            balanceAfter: subscription.coins,
          },
        });

        await tx.pilot.update({
          where: { userId },
          data: {
            isFairCoinAvailed: true,
          },
        });
      });

      return {
        message: 'Pilot onboarding coins availed successfully.',
      };
    } catch (error) {
      console.error(error);
      throw error;
    }
  }

  async availBonusRecharge(freeRechargeDto: FreeRechargeDto, userId: string) {
    const { coupon } = freeRechargeDto;

    try {
      const pilot = await this.prisma.pilot.findUnique({ where: { userId } });
      if (!pilot) {
        throw new NotFoundException('Pilot not found.');
      }
      const wallet = await this.prisma.pilotWallet.findUnique({
        where: { pilotId: pilot.id },
      });
      if (!wallet) {
        throw new NotFoundException('Pilot wallet not found.');
      }
      if (!wallet.autoRechargeEnabled) {
        throw new BadRequestException(
          'Pilot does not have auto recharge enabled.',
        );
      }

      const pilotCoupon = await this.prisma.pilotCoupon.findUnique({
        where: {
          name: coupon,
        },
      });
      if (!pilotCoupon) {
        throw new NotFoundException('This coupon is not valid');
      }

      const subscription = await this.prisma.subscription.findUnique({
        where: { name: this.flexiPack },
      });

      const balanceBefore = Number(wallet.balance);
      const balanceAfter = balanceBefore + Number(subscription.coins);

      await this.prisma.$transaction(async (tx) => {
        // Update wallet with bonus
        await tx.pilotWallet.update({
          where: { pilotId: pilot.id },
          data: {
            balance: balanceAfter,
          },
        });

        // Create the transaction record
        await tx.transaction.create({
          data: {
            pilotId: pilot.id,
            amount: Number(subscription.coins),
            walletId: wallet.id,
            type: TransactionType.AUTO_RECHARGE,
            status: TransactionStatus.SUCCESSFUL,
            balanceBefore,
            balanceAfter,
          },
        });

        // Reset the bonus eligibility flag
        await tx.pilotWallet.update({
          where: { pilotId: pilot.id },
          data: {
            autoRechargeEnabled: false,
            autoRechargeAmount: Number(subscription.coins),
            autoRechargeDate: moment.utc().toDate(),
            autoRechargeEnabledUntil: moment.utc().add(1, 'day').toDate(),
          },
        });
      });

      return {
        message: 'Bonus recharge availed successfully!',
        data: {
          bonusAmount: Number(subscription.coins),
          newBalance: balanceAfter,
        },
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
        // type: TransactionType.SUBSCRIPTION_PURCHASE,
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

        const h3 = h3Cell(currentLocation.lat, currentLocation.lng, 8);
        await this.telemetryService.setSupply(h3, 1);
      }

      if (!onlineStatus) {
        await this.redis.zRem(RedisKeys.PILOT_LOCATION, pilot.userId);

        const h3 = h3Cell(currentLocation.lat, currentLocation.lng, 8);
        await this.telemetryService.setSupply(h3, -1);
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
    role: UserRole,
  ) {
    try {
      let pilot = null;
      if (role === UserRole.PILOT) {
        pilot = await this.prisma.pilot.findUnique({ where: { userId } });
      } else {
        pilot = await this.prisma.pilot.findUnique({ where: { id: userId } });
      }
      if (!pilot) {
        throw new NotFoundException('Pilot not found.');
      }
      if (
        role === UserRole.PILOT &&
        pilot.isDLVerified === VerificationStatus.APPROVED
      ) {
        throw new BadRequestException(
          'Pilot already verified Driving License.',
        );
      }
      const previousFrontUrl = pilot.dlFrontSideUrl;
      const previousBackUrl = pilot.dlBackSideUrl;

      const frontSideBuffer = files.front[0].buffer;
      const frontSideUrl = await this.azureService.uploadFile(
        frontSideBuffer,
        files.front[0].originalname,
        pilot.userId,
        files.front[0].mimetype,
      );

      let backSideUrl = null;
      if (files.back) {
        const backSideBuffer = files.back[0].buffer;
        backSideUrl = await this.azureService.uploadFile(
          backSideBuffer,
          files.back[0].originalname,
          pilot.userId,
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
        where: { id: pilot.id },
        data: updateData,
      });

      let verificationResponse =
        await this.verificationService.extractDLData(frontSideBuffer);

      if (!verificationResponse) {
        throw new BadRequestException(
          'Failed to extract driving license data.',
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
        frontSideUrl: frontSideUrl,
        backSideUrl: backSideUrl,
      };

      await this.deletePreviousFiles(previousFrontUrl, previousBackUrl);

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
          name: name,
        },
      });

      await this.updateUserStatusAfterDocumentUpload(pilot.id);

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
    role: UserRole,
    nidType: BDNidType,
  ) {
    try {
      let pilot = null;

      if (role === UserRole.PILOT) {
        pilot = await this.prisma.pilot.findUnique({
          where: { userId },
          include: { nid: true },
        });
      } else {
        pilot = await this.prisma.pilot.findUnique({
          where: { id: userId },
          include: { nid: true },
        });
      }

      if (!pilot) {
        throw new NotFoundException('Pilot not found.');
      }
      if (
        role === UserRole.PILOT &&
        nidType === BDNidType.PILOT &&
        pilot.isNidVerified === VerificationStatus.APPROVED
      ) {
        throw new BadRequestException('Pilot already verified NID.');
      }
      if (
        role === UserRole.PILOT &&
        nidType === BDNidType.VEHICLE_OWNER &&
        pilot.isVehicleOwnersNidVerified === VerificationStatus.APPROVED
      ) {
        throw new BadRequestException('Vehicle owner already verified NID.');
      }

      let previousFrontUrl = null;
      let previousBackUrl = null;
      if (nidType === BDNidType.PILOT) {
        previousFrontUrl = pilot.nidFrontSideUrl;
        previousBackUrl = pilot.nidBackSideUrl;
      } else if (nidType === BDNidType.VEHICLE_OWNER) {
        previousFrontUrl = pilot.vehicleOwnersNidFrontSideUrl;
        previousBackUrl = pilot.vehicleOwnersNidBackSideUrl;
      }

      const frontSideBuffer = files.front[0].buffer;
      const backSideBuffer = files.back[0].buffer;

      const frontSideUrl = await this.azureService.uploadFile(
        frontSideBuffer,
        files.front[0].originalname,
        pilot.userId,
        files.front[0].mimetype,
      );

      const backSideUrl = await this.azureService.uploadFile(
        backSideBuffer,
        files.back[0].originalname,
        pilot.userId,
        files.back[0].mimetype,
      );

      if (frontSideUrl && backSideUrl) {
        if (nidType === BDNidType.PILOT) {
          await this.prisma.pilot.update({
            where: { id: pilot.id },
            data: {
              nidFrontSideUrl: frontSideUrl,
              nidBackSideUrl: backSideUrl,
            },
          });
        }

        if (nidType === BDNidType.VEHICLE_OWNER) {
          await this.prisma.pilot.update({
            where: { id: pilot.id },
            data: {
              vehicleOwnersNidFrontSideUrl: frontSideUrl,
              vehicleOwnersNidBackSideUrl: backSideUrl,
            },
          });
        }
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

      await this.deletePreviousFiles(previousFrontUrl, previousBackUrl);

      return {
        message: 'NID data extracted successfully.',
        data: {
          dateOfBirth: formattedDateOfBirth,
          nidNumber: verificationResponse.nidNumber,
          name: verificationResponse.name,
          frontSideUrl: frontSideUrl,
          backSideUrl: backSideUrl,
        },
      };
    } catch (error) {
      console.error(error);
      throw error;
    }
  }

  async processBDNid(bDNidDto: BDNidDto, userId: string, nidType: BDNidType) {
    const { nidNumber, name, dateOfBirth } = bDNidDto;

    try {
      const pilot = await this.prisma.pilot.findUnique({ where: { userId } });
      if (!pilot) {
        throw new NotFoundException('Pilot not found.');
      }
      if (
        nidType === BDNidType.PILOT &&
        pilot.isNidVerified === VerificationStatus.APPROVED
      ) {
        throw new BadRequestException('Pilot already verified NID.');
      }
      if (
        nidType === BDNidType.VEHICLE_OWNER &&
        pilot.isVehicleOwnersNidVerified === VerificationStatus.APPROVED
      ) {
        throw new BadRequestException('Vehicle owner already verified NID.');
      }

      let data = null;

      if (nidType === BDNidType.PILOT) {
        data = await this.prisma.nid.upsert({
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

        const updatedPilot = await this.prisma.pilot.update({
          where: { userId },
          data: {
            isNidVerified: VerificationStatus.IN_PROGRESS,
          },
        });

        await this.updateUserStatusAfterDocumentUpload(updatedPilot.id);
      } else if (nidType === BDNidType.VEHICLE_OWNER) {
        data = await this.prisma.nid.upsert({
          where: { pilotId: pilot.id },
          update: {
            vehicleOwnerNidNumber: nidNumber,
            vehicleOwnerNidName: name,
            vehicleOwnerNidDateOfBirth: dateOfBirth,
          },
          create: {
            vehicleOwnerNidNumber: nidNumber,
            vehicleOwnerNidName: name,
            vehicleOwnerNidDateOfBirth: dateOfBirth,
            pilotId: pilot.id,
          },
        });

        const updatedPilot = await this.prisma.pilot.update({
          where: { userId },
          data: {
            isVehicleOwnersNidVerified: VerificationStatus.IN_PROGRESS,
          },
        });

        await this.updateUserStatusAfterDocumentUpload(updatedPilot.id);
      }

      const transformedData = {
        dateOfBirth:
          nidType === BDNidType.PILOT
            ? data.dateOfBirth
            : data.vehicleOwnerNidDateOfBirth,
        nidNumber:
          nidType === BDNidType.PILOT
            ? data.nidNumber
            : data.vehicleOwnerNidNumber,
        name:
          nidType === BDNidType.PILOT ? data.name : data.vehicleOwnerNidName,
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
    files: { front: Express.Multer.File[]; back?: Express.Multer.File[] },
    userId: string,
    role: UserRole,
  ) {
    try {
      let pilot = null;
      if (role === UserRole.PILOT) {
        pilot = await this.prisma.pilot.findUnique({ where: { userId } });
      } else {
        pilot = await this.prisma.pilot.findUnique({ where: { id: userId } });
      }
      if (!pilot) {
        throw new NotFoundException('Pilot not found.');
      }
      if (
        role === UserRole.PILOT &&
        pilot.isRCVerified === VerificationStatus.APPROVED
      ) {
        throw new BadRequestException('Pilot already verified RC.');
      }

      const previousFrontUrl = pilot.rcFrontSideUrl;
      const previousBackUrl = pilot.rcBackSideUrl;

      const frontSideBuffer = files.front[0].buffer;
      const frontSideUrl = await this.azureService.uploadFile(
        frontSideBuffer,
        files.front[0].originalname,
        pilot.userId,
        files.front[0].mimetype,
      );

      let backSideUrl = null;
      if (files.back) {
        const backSideBuffer = files.back[0].buffer;
        backSideUrl = await this.azureService.uploadFile(
          backSideBuffer,
          files.back[0].originalname,
          pilot.userId,
          files.back[0].mimetype,
        );
      }

      const updateData: any = {
        rcFrontSideUrl: frontSideUrl,
      };

      if (backSideUrl) {
        updateData.rcBackSideUrl = backSideUrl;
      }

      await this.prisma.pilot.update({
        where: { id: pilot.id },
        data: updateData,
      });

      let verificationResponse =
        await this.verificationService.extractRCData(frontSideBuffer);

      if (!verificationResponse) {
        throw new BadRequestException('Failed to extract RC data.');
      }

      if (
        !verificationResponse.registrationPoint &&
        !verificationResponse.series &&
        !verificationResponse.seriesEnglish &&
        !verificationResponse.number &&
        !verificationResponse.vehicleType &&
        !verificationResponse.registrationDate &&
        !verificationResponse.vehicleColour &&
        !verificationResponse.model &&
        !verificationResponse.seatCapacity
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
        frontSideUrl: frontSideUrl,
        backSideUrl: backSideUrl,
      };

      await this.deletePreviousFiles(previousFrontUrl, previousBackUrl);

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
    const {
      vehicleNumber,
      vehicleType,
      registrationDate,
      vehicleColour,
      model,
      seatCapacity,
    } = bDRCDto;

    try {
      const pilot = await this.prisma.pilot.findUnique({ where: { userId } });
      if (!pilot) {
        throw new NotFoundException('Pilot not found.');
      }

      if (pilot.isRCVerified === VerificationStatus.APPROVED) {
        throw new BadRequestException('Pilot already verified RC.');
      }

      const updatedPilot = await this.prisma.pilot.update({
        where: { userId },
        data: {
          isRCVerified: VerificationStatus.IN_PROGRESS,
        },
      });

      const vehicleTypeBD =
        await this.verificationService.mapVehicleType(vehicleType);
      if (
        !vehicleTypeBD ||
        !Object.values(VehicleTypeNameBD).includes(vehicleTypeBD)
      ) {
        throw new BadRequestException('Invalid vehicle type');
      }

      const vehicleTypeBDId = await this.prisma.vehicleTypeBD.findUnique({
        where: {
          name: vehicleTypeBD,
        },
        select: {
          id: true,
        },
      });

      const data = await this.prisma.vehicle.upsert({
        where: { pilotId: pilot.id },
        create: {
          regNo: vehicleNumber,
          registrationDate,
          colour: vehicleColour,
          model,
          seatCapacity,
          pilotId: pilot.id,
          vehicleTypeIdBD: vehicleTypeBDId.id,
        },
        update: {
          regNo: vehicleNumber,
          registrationDate,
          colour: vehicleColour,
          model: vehicleType,
          pilotId: pilot.id,
          vehicleTypeIdBD: vehicleTypeBDId.id,
        },
      });

      await this.prisma.pilot.update({
        where: { userId },
        data: {
          primaryVehicleTypeId: vehicleTypeBDId.id,
        },
      });

      const transformedData = {
        vehicleNumber: data.regNo,
        vehicleType: data.model,
        registrationDate: data.registrationDate,
        vehicleColour: data.colour,
      };

      await this.updateUserStatusAfterDocumentUpload(updatedPilot.id);

      return {
        message: 'RC data added successfully.',
        data: transformedData,
      };
    } catch (error) {
      console.error(error);
      throw error;
    }
  }

  async uploadNumberPlate(
    file: Express.Multer.File,
    userId: string,
    role: UserRole,
  ) {
    try {
      let pilot = null;
      if (role === UserRole.PILOT) {
        pilot = await this.prisma.pilot.findUnique({
          where: { userId },
          include: { numberPlate: true },
        });
      } else {
        pilot = await this.prisma.pilot.findUnique({
          where: { id: userId },
          include: { numberPlate: true },
        });
      }
      if (!pilot) {
        throw new NotFoundException('Pilot not found.');
      }
      if (
        role === UserRole.PILOT &&
        pilot.isNumberPlateVerified === VerificationStatus.APPROVED
      ) {
        throw new BadRequestException('Pilot already verified number plate.');
      }

      const previousNumberPlateUrl = pilot.numberPlateUrl;

      const numberPlateBuffer = file.buffer;

      const numberPlateUrl = await this.azureService.uploadFile(
        numberPlateBuffer,
        file.originalname,
        pilot.userId,
        file.mimetype,
      );

      await this.prisma.pilot.update({
        where: { id: pilot.id },
        data: {
          numberPlateUrl,
        },
      });

      let verificationResponse =
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

      const numberPlate = await this.prisma.numberPlate.upsert({
        where: { pilotId: pilot.id },
        update: {
          numberPlate: verificationResponse.numberPlate,
        },
        create: {
          numberPlate: verificationResponse.numberPlate,
          pilotId: pilot.id,
        },
      });

      verificationResponse = {
        ...verificationResponse,
        numberPlateUrl: numberPlateUrl,
        numberPlate: numberPlate.numberPlate,
      };

      await this.deletePreviousFiles(previousNumberPlateUrl);

      return {
        message: 'Number plate uploaded successfully.',
        data: verificationResponse,
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

      // const vehicle = await this.prisma.vehicle.findFirst({
      //   where: { pilotId: pilot.id },
      //   select: {
      //     regNo: true,
      //   },
      // });
      // if (!vehicle) {
      //   throw new BadRequestException(
      //     'You did not upload any vehicle registration number.',
      //   );
      // }

      // if (!vehicle.regNo.includes(numberPlate)) {
      //   throw new BadRequestException(
      //     'Number plate does not match with vehicle registration number.',
      //   );
      // }

      const updatedPilot = await this.prisma.pilot.update({
        where: { userId },
        data: {
          isNumberPlateVerified: VerificationStatus.IN_PROGRESS,
        },
      });

      await this.updateUserStatusAfterDocumentUpload(updatedPilot.id);

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

  async uploadTaxToken(
    file: Express.Multer.File,
    userId: string,
    role: UserRole,
  ) {
    try {
      let pilot = null;
      if (role === UserRole.PILOT) {
        pilot = await this.prisma.pilot.findUnique({ where: { userId } });
      } else {
        pilot = await this.prisma.pilot.findUnique({ where: { id: userId } });
      }

      if (!pilot) {
        throw new NotFoundException('Pilot not found.');
      }
      if (
        role === UserRole.PILOT &&
        pilot.isTaxTokenVerified === VerificationStatus.APPROVED
      ) {
        throw new BadRequestException('Pilot already verified tax token.');
      }

      const previousTaxTokenUrl = pilot.taxTokenUrl;

      const taxTokenBuffer = file.buffer;

      const taxTokenUrl = await this.azureService.uploadFile(
        taxTokenBuffer,
        file.originalname,
        pilot.userId,
        file.mimetype,
      );

      let verificationResponse: any =
        await this.verificationService.extractTaxTokenData(taxTokenBuffer);

      if (!verificationResponse) {
        throw new BadRequestException('Failed to extract tax token data.');
      }

      if (!verificationResponse.registrationNumber) {
        throw new BadRequestException(
          'Tax token is not valid or not readable.',
        );
      }

      const updatedPilot = await this.prisma.pilot.update({
        where: { id: pilot.id },
        data: {
          taxTokenUrl,
          isTaxTokenVerified: VerificationStatus.IN_PROGRESS,
        },
      });

      await this.deletePreviousFiles(previousTaxTokenUrl);

      const taxToken = await this.prisma.taxToken.upsert({
        where: { pilotId: pilot.id },
        update: {
          registrationNumber: verificationResponse.registrationNumber,
        },
        create: {
          registrationNumber: verificationResponse.registrationNumber,
          pilotId: pilot.id,
        },
      });

      verificationResponse = {
        ...verificationResponse,
        taxTokenUrl: taxTokenUrl,
        registrationNumber: taxToken.registrationNumber,
      };

      await this.updateUserStatusAfterDocumentUpload(updatedPilot.id);
      return {
        message: 'Tax token uploaded successfully.',
        data: verificationResponse,
      };
    } catch (error) {
      console.error(error);
      throw error;
    }
  }

  async updateDriverDetails(
    updateDriverDetailsDto: UpdateDriverDetailsDto,
    userId: string,
  ) {
    const { name, city } = updateDriverDetailsDto;

    try {
      const pilot = await this.prisma.pilot.findUnique({ where: { userId } });
      if (!pilot) {
        throw new NotFoundException('Pilot not found.');
      }

      await this.prisma.pilot.update({
        where: { userId },
        data: { name, city },
      });

      return {
        message: 'Driver details updated successfully.',
        data: { name, city },
      };
    } catch (error) {
      console.error(error);
      throw error;
    }
  }

  async getCoupons(userId: string) {
    const pilot = await this.prisma.pilot.findUnique({ where: { userId } });
    if (!pilot) {
      throw new NotFoundException('Pilot not found.');
    }

    const coupons = await this.prisma.pilotCoupon.findMany({
      include: {
        subscription: {
          select: {
            name: true,
          },
        },
      },
    });

    coupons.forEach((coupon: any) => {
      coupon.message =
        'Only applicabel for ' + coupon.subscription.name + ' (1X)';
      delete coupon.subscription;
    });

    return {
      message: 'Coupons fetched successfully.',
      data: coupons,
    };
  }

  private async getOcrResult(buffer: any) {
    const ocrResult = await this.azureService.extractTextFromImage(buffer);

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

  private async deletePreviousFiles(frontUrl: string, backUrl?: string) {
    try {
      const deletePromises: Promise<void>[] = [];

      if (frontUrl) {
        deletePromises.push(this.azureService.deleteFile(frontUrl));
      }

      if (backUrl) {
        deletePromises.push(this.azureService.deleteFile(backUrl));
      }

      if (deletePromises.length > 0) {
        await Promise.allSettled(deletePromises);
      }
    } catch (error) {
      console.error('Error cleaning up previous files', error);
    }
  }

  private async updateUserStatusToOnboarding(id: string) {
    const user = await this.prisma.user.findUnique({ where: { id } });

    if (user.status !== UserStatus.ONBOARDING) {
      await this.prisma.user.update({
        where: { id: user.id },
        data: { status: UserStatus.ONBOARDING },
      });
    }
  }

  public async updateUserStatusAfterDocumentUpload(pilotId: string) {
    const pilot = await this.prisma.pilot.findUnique({
      where: { id: pilotId },
      select: {
        userId: true,
        isSelfieVerified: true,
        isDLVerified: true,
        isRCVerified: true,
        isNidVerified: true,
        isTaxTokenVerified: true,
        isNumberPlateVerified: true,
        isVehicleOwnersNidVerified: true,
        selfieUrl: true,
        dlFrontSideUrl: true,
        dlBackSideUrl: true,
        rcFrontSideUrl: true,
        rcBackSideUrl: true,
        nidFrontSideUrl: true,
        nidBackSideUrl: true,
        taxTokenUrl: true,
        numberPlateUrl: true,
        vehicleOwnersNidFrontSideUrl: true,
        vehicleOwnersNidBackSideUrl: true,
      },
    });

    if (!pilot) return;

    // Use consistent logic with admin-driver.service.ts
    const expectedStatus = this.determineUserStatus(pilot);

    // Get current user status
    const user = await this.prisma.user.findUnique({
      where: { id: pilot.userId },
      select: { status: true },
    });

    if (!user) return;

    // Validate status transition before updating
    if (user.status !== expectedStatus) {
      this.validateStatusTransition(user.status, expectedStatus);

      await this.prisma.user.update({
        where: { id: pilot.userId },
        data: { status: expectedStatus },
      });
    }
  }

  /**
   * Determines the appropriate UserStatus based on document upload and verification states
   * This method ensures consistency with admin-driver.service.ts logic
   *
   * Rules:
   * - ACTIVE: All documents APPROVED
   * - IN_REVIEW: All documents uploaded AND at least one is IN_PROGRESS or PENDING
   * - ONBOARDING: One or more documents uploaded but not all, OR all uploaded but none in review
   * - INACTIVE: Verified by OTP but no documents submitted (handled in auth.service.ts)
   */
  private determineUserStatus(pilot: {
    selfieUrl: string | null;
    dlFrontSideUrl: string | null;
    dlBackSideUrl: string | null;
    rcFrontSideUrl: string | null;
    rcBackSideUrl: string | null;
    nidFrontSideUrl: string | null;
    nidBackSideUrl: string | null;
    taxTokenUrl: string | null;
    numberPlateUrl: string | null;
    vehicleOwnersNidFrontSideUrl: string | null;
    vehicleOwnersNidBackSideUrl: string | null;
    isSelfieVerified: VerificationStatus;
    isDLVerified: VerificationStatus;
    isRCVerified: VerificationStatus;
    isNidVerified: VerificationStatus;
    isTaxTokenVerified: VerificationStatus;
    isNumberPlateVerified: VerificationStatus;
    isVehicleOwnersNidVerified: VerificationStatus;
  }): UserStatus {
    // Check if all documents are uploaded (have URLs)
    const allDocumentsUploaded = [
      pilot.selfieUrl,
      pilot.dlFrontSideUrl,
      pilot.dlBackSideUrl,
      pilot.rcFrontSideUrl,
      pilot.rcBackSideUrl,
      pilot.nidFrontSideUrl,
      pilot.nidBackSideUrl,
      pilot.taxTokenUrl,
      pilot.numberPlateUrl,
      pilot.vehicleOwnersNidFrontSideUrl,
      pilot.vehicleOwnersNidBackSideUrl,
    ].every((url) => url !== null && url !== undefined);

    if (!allDocumentsUploaded) {
      // Not all documents uploaded - set ONBOARDING
      // Rule: "submitted one or more documents but not all"
      return UserStatus.ONBOARDING;
    }

    // All documents are uploaded - check verification statuses
    const documentStatuses = [
      pilot.isSelfieVerified,
      pilot.isDLVerified,
      pilot.isRCVerified,
      pilot.isNidVerified,
      pilot.isTaxTokenVerified,
      pilot.isNumberPlateVerified,
      pilot.isVehicleOwnersNidVerified,
    ];

    // Check if all documents are approved
    const allDocumentsApproved = documentStatuses.every(
      (status) => status === VerificationStatus.APPROVED,
    );

    if (allDocumentsApproved) {
      // All documents approved - should be ACTIVE
      // Rule: "status active for driver when all the documents get Approved"
      return UserStatus.ACTIVE;
    }

    // Check if at least one document is IN_PROGRESS or PENDING (review in progress)
    const hasDocumentInReview = documentStatuses.some(
      (status) =>
        status === VerificationStatus.IN_PROGRESS ||
        status === VerificationStatus.PENDING,
    );

    if (hasDocumentInReview) {
      // All documents uploaded and at least one is in review - set IN_REVIEW
      // Rule: "when driver submitted all documents and document review in progress"
      return UserStatus.IN_REVIEW;
    }

    // All documents uploaded but none in review (all rejected or mixed states) - set ONBOARDING
    // Rule: "submitted one or more documents but not all" - but in this case all are uploaded,
    // so we set ONBOARDING to allow resubmission
    return UserStatus.ONBOARDING;
  }

  /**
   * Validates status transitions to prevent invalid state changes
   * @param currentStatus - Current user status
   * @param newStatus - Desired new status
   * @throws BadRequestException if transition is invalid
   */
  private validateStatusTransition(
    currentStatus: UserStatus,
    newStatus: UserStatus,
  ): void {
    // No validation needed if status is unchanged
    if (currentStatus === newStatus) {
      return;
    }

    // DELETED is a terminal state - cannot transition from it
    if (currentStatus === UserStatus.DELETED) {
      throw new BadRequestException(
        'Cannot change status of a deleted user. User must be restored first.',
      );
    }

    // SUSPENDED can only be changed by unsuspend operation (handled separately)
    // But we allow transitions from SUSPENDED if documents are being processed
    if (
      currentStatus === UserStatus.SUSPENDED &&
      newStatus !== UserStatus.ACTIVE
    ) {
      // Allow SUSPENDED -> ONBOARDING/IN_REVIEW if documents are being updated
      if (
        newStatus === UserStatus.ONBOARDING ||
        newStatus === UserStatus.IN_REVIEW
      ) {
        return; // Allow this transition
      }
    }

    // INACTIVE can only transition to ONBOARDING (when first document is uploaded)
    if (currentStatus === UserStatus.INACTIVE) {
      if (newStatus !== UserStatus.ONBOARDING) {
        throw new BadRequestException(
          `Invalid status transition: ${currentStatus} -> ${newStatus}. INACTIVE users can only transition to ONBOARDING when documents are uploaded.`,
        );
      }
      return;
    }

    // ACTIVE can only transition to ONBOARDING (if document is rejected) or SUSPENDED/DELETED
    if (currentStatus === UserStatus.ACTIVE) {
      const allowedTransitions: UserStatus[] = [
        UserStatus.ONBOARDING,
        UserStatus.SUSPENDED,
        UserStatus.DELETED,
      ];
      if (!allowedTransitions.includes(newStatus)) {
        throw new BadRequestException(
          `Invalid status transition: ${currentStatus} -> ${newStatus}. ACTIVE users can only transition to ONBOARDING (document rejection), SUSPENDED, or DELETED.`,
        );
      }
      return;
    }

    // IN_REVIEW can transition to ONBOARDING (document rejected), ACTIVE (all approved), SUSPENDED, or DELETED
    if (currentStatus === UserStatus.IN_REVIEW) {
      const allowedTransitions: UserStatus[] = [
        UserStatus.ONBOARDING,
        UserStatus.ACTIVE,
        UserStatus.SUSPENDED,
        UserStatus.DELETED,
      ];
      if (!allowedTransitions.includes(newStatus)) {
        throw new BadRequestException(
          `Invalid status transition: ${currentStatus} -> ${newStatus}. IN_REVIEW users can only transition to ONBOARDING (document rejection), ACTIVE (all approved), SUSPENDED, or DELETED.`,
        );
      }
      return;
    }

    // ONBOARDING can transition to IN_REVIEW (all documents uploaded), ACTIVE (all approved), SUSPENDED, or DELETED
    if (currentStatus === UserStatus.ONBOARDING) {
      const allowedTransitions: UserStatus[] = [
        UserStatus.IN_REVIEW,
        UserStatus.ACTIVE,
        UserStatus.SUSPENDED,
        UserStatus.DELETED,
      ];
      if (!allowedTransitions.includes(newStatus)) {
        throw new BadRequestException(
          `Invalid status transition: ${currentStatus} -> ${newStatus}. ONBOARDING users can only transition to IN_REVIEW (all documents uploaded), ACTIVE (all approved), SUSPENDED, or DELETED.`,
        );
      }
      return;
    }
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
