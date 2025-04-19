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
  AcceptRideDto,
  StartRideDto,
} from './dto/pilot.dto';
import {
  RideResponse,
  CustomerRidePayload,
  VerificationResponseDL,
  VerificationResponseVehicle,
} from './interfaces/pilot.interface';
import { RideGateway } from '../ride/ride.gateway';
import formatDate from 'src/common/functions/formatDate';
import { VerifyAadhaarDto } from './dto/pilot.dto';
import { RedisService } from 'src/core/cache/redis.service';
import { VerifyPhoneDto } from 'src/common/dto/common.dto';
import {
  BookingStatus,
  PilotStatus,
  TransactionStatus,
  TransactionType,
} from '@prisma/client';
import { FareService } from '../fare/fare.service';
import { RideEvents } from 'src/core/socket/socket-events';

@Injectable()
export class PilotService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly azureServicce: AzureService,
    private readonly verificationService: VerificationService,
    private readonly rideGateway: RideGateway,
    private readonly redis: RedisService,
    private readonly fareService: FareService,
  ) {}

  async getPilot(userId: string) {
    try {
      const data: any = await this.prisma.pilot.findUnique({
        where: { userId },
        include: {
          language: true,
          drivingLicense: true,
          wallet: true,
        },
      });
      if (!data) {
        throw new NotFoundException('Pilot not found.');
      }

      if (data.wallet) {
        data.wallet.balance = data.wallet.balance
          ? Number(data.wallet.balance)
          : 0;
        data.wallet.minusLimit = Number(data.wallet.minusLimit);
        data.wallet.todaysEarning = data.wallet.todaysEarning
          ? Number(data.wallet.todaysEarning)
          : 0;
        data.wallet.lastTripEarning = data.wallet.lastTripEarning
          ? Number(data.wallet.lastTripEarning)
          : 0;
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

      if (pilot.selfieUrl) {
        throw new ForbiddenException('Live selfie can be uploaded only once.');
      }
      if (!pilot.isDLVerified) {
        throw new ForbiddenException(
          'Driving License must be verified before uploading Live selfie.',
        );
      }

      const fileUrl = file.azureFileUrl;

      if (fileUrl) {
        await this.prisma.pilot.update({
          where: { userId },
          data: { selfieUrl: fileUrl },
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
      if (!pilot.isRCVerified) {
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
          isPanCardVerified: true,
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
      if (!pilot.isRCVerified) {
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
          isPanCardVerified: true,
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
      if (!pilot.isPanCardVerified) {
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
      if (!pilot.isPanCardVerified) {
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
          isAadhaarVerified: true,
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
      if (!pilot.isDLVerified || !pilot.isRCVerified) {
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
          vehicleType: true,
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
    page: number = 1,
    pageSize: number = 10,
  ) {
    try {
      const pilot = await this.prisma.pilot.findUnique({ where: { userId } });
      if (!pilot) {
        throw new NotFoundException('Pilot not found.');
      }

      const skip = (page - 1) * pageSize;

      // Get the total count for pagination metadata
      const totalCount = await this.prisma.transaction.count({
        where: { pilotId: pilot.id },
      });

      // Get the paginated data
      const data: any = await this.prisma.transaction.findMany({
        where: { pilotId: pilot.id },
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
      const pilot = await this.prisma.pilot.findUnique({ where: { userId } });
      if (!pilot) {
        throw new NotFoundException('Pilot not found.');
      }

      if (!onlineStatus) {
        await this.redis.zRem('pilotLocations', pilot.id);
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

  async acceptRide(acceptRideDto: AcceptRideDto, userId: string) {
    const { bookingId } = acceptRideDto;

    try {
      const pilot = await this.prisma.pilot.findUnique({
        where: { userId },
        include: { drivingLicense: true, vehicle: true },
      });
      if (!pilot) throw new NotFoundException('Pilot not found.');

      const result = await this.prisma.$transaction(async (tx) => {
        await tx.pilot.update({
          where: { userId },
          data: {
            activeBookingId: bookingId,
          },
        });

        const booking = await tx.booking.findFirst({
          where: { id: bookingId, status: BookingStatus.PENDING },
        });
        if (!booking) throw new BadRequestException('Booking not found.');

        const updated = await tx.booking.update({
          where: { id: booking.id },
          data: {
            pilotId: pilot.id,
            status: BookingStatus.ACCEPTED,
            acceptedAt: new Date(),
          },
          include: {
            customer: {
              include: {
                coupon: true,
              },
            },
            pilot: true,
          },
        });

        return { updated };
      });

      const pilotLocation = await this.redis.geoPos('pilotLocations', pilot.id);

      let pickupInMinutes: number | null = null;

      if (pilotLocation) {
        const [lat, lng] = pilotLocation;
        const { durationMin } =
          await this.fareService.calculateDistanceAndDuration(
            { lat, lng },
            result.updated.pickupLocation as any,
          );
        pickupInMinutes = Math.ceil(durationMin);
      }

      const vehicleId = await this.redis.get(
        `booking-vehicle:${bookingId}:${pilot.id}`,
      );
      const vehicle = vehicleId
        ? await this.prisma.vehicle.findUnique({
            where: { id: vehicleId },
            include: { vehicleType: true },
          })
        : null;

      await this.redis.del(`booking-vehicle:${bookingId}:${pilot.id}`);
      // await this.redis.del(`notified-${bookingId}:${pilot.id}`);
      await this.redis.del(`ride-accept:${bookingId}`);

      // Cache active ride in Redis
      await this.redis.setActiveRide(
        pilot.id,
        result.updated.id,
        result.updated.customer.userId,
      );

      let couponForPayload = null;
      if (result?.updated?.customer?.coupon) {
        couponForPayload = {
          ...result.updated.customer.coupon,
          discount: result.updated.customer.coupon.discount
            ? Number(result.updated.customer.coupon.discount)
            : 0.0,
        };
      }

      const rideAcceptedPayload: CustomerRidePayload = {
        bookingCode: result.updated.bookingCode,
        bookingId: result.updated.id,
        bookingStatus: result.updated.status,
        pilot: {
          pilotName: pilot.drivingLicense.nameOnLicense,
          profilePicture: pilot.selfieUrl,
          pilotPhone: pilot.phone,
          rating: pilot.averageRating,
          pilotLocation: {
            lat: pilotLocation[0],
            lng: pilotLocation[1],
          },
          vehicleNumber: vehicle.regNo,
          model: vehicle.model,
          colour: vehicle.colour,
          vehicleType: vehicle.vehicleType.name,
        },
        pickupInMinutes,
        pickupLocation: result.updated.pickupLocation,
        dropLocation: result.updated.dropLocation,
        fairDetails: {
          origialFare: Number(result.updated.estimatedFare),
          discountedFare: Number(result.updated.discountedFare),
          coupon: couponForPayload,
        },
      };

      // rideAccepted event triggered for customer
      this.rideGateway.server
        .to(result.updated.customer.userId)
        .emit(RideEvents.RIDE_ACCEPTED, rideAcceptedPayload);

      const data: RideResponse = {
        bookingId: result.updated.id,
        fare: Number(result.updated.discountedFare),
        customerName: result.updated.customer.name,
        customerPhone: result.updated.customer.phone,
        averageRating: result.updated.customer.averageRating,
        pickupLocation: result.updated.pickupLocation,
        dropLocation: result.updated.dropLocation,
        rideStatus: result.updated.status,
      };

      return {
        message: 'Ride accepted successfully.',
        data,
      };
    } catch (error) {
      console.error(error);
      throw error;
    }
  }

  async startRide(startRideDto: StartRideDto, userId: string) {
    const { bookingId, bookingCode } = startRideDto;

    try {
      const booking = await this.prisma.booking.findUnique({
        where: { id: bookingId },
        include: {
          customer: { include: { coupon: true } },
          pilot: {
            include: {
              drivingLicense: true,
              vehicle: { include: { vehicleType: true } },
            },
          },
        },
      });

      if (!booking || booking.bookingCode !== bookingCode) {
        throw new BadRequestException('Invalid Booking.');
      }

      await this.prisma.booking.update({
        where: { id: bookingId },
        data: {
          status: BookingStatus.STARTED,
          tripStart: new Date(),
        },
      });

      const pilotLocation = await this.redis.geoPos(
        'pilotLocations',
        booking.pilot.id,
      );

      const payload: CustomerRidePayload = {
        bookingCode: booking.bookingCode,
        bookingId: booking.id,
        bookingStatus: booking.status,
        pilot: {
          pilotName: booking.pilot.drivingLicense.nameOnLicense,
          profilePicture: booking.pilot.selfieUrl,
          pilotPhone: booking.pilot.phone,
          rating: booking.pilot.averageRating,
          pilotLocation: {
            lat: pilotLocation[0],
            lng: pilotLocation[1],
          },
          vehicleNumber: booking.pilot.vehicle.regNo,
          model: booking.pilot.vehicle.model,
          colour: booking.pilot.vehicle.colour,
          vehicleType: booking.pilot.vehicle.vehicleType.name,
        },
        pickupInMinutes: null,
        pickupLocation: booking.pickupLocation,
        dropLocation: booking.dropLocation,
        fairDetails: {
          origialFare: Number(booking.estimatedFare),
          discountedFare: Number(booking.discountedFare),
          coupon: booking.customer.coupon,
        },
      };

      this.rideGateway.server
        .to(booking.customer.userId)
        .emit(RideEvents.RIDE_STARTED, payload);

      const data: RideResponse = {
        bookingId: booking.id,
        fare: Number(booking.discountedFare),
        customerName: booking.customer.name,
        customerPhone: booking.customer.phone,
        averageRating: booking.customer.averageRating,
        pickupLocation: booking.pickupLocation,
        dropLocation: booking.dropLocation,
        rideStatus: booking.status,
      };

      return {
        message: 'Ride started successfully.',
        data,
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
        isDLVerified: true,
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
    console.log(lines);
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

    const vehicleCategory = await this.prisma.vehicleType.findFirst({
      where: {
        name: category,
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
        vehicleType: {
          connect: { id: vehicleCategory.id },
        },
      },
    });

    // Update pilot record with vehicle information
    await this.prisma.pilot.update({
      where: { id: pilotId },
      data: {
        isRCVerified: true,
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
