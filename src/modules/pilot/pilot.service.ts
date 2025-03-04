import {
  Injectable,
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'src/core/database/prisma.service';
import { AzureService } from 'src/core/utils/azure.util';
import { VerificationService } from 'src/core/utils/verification.util';
import {
  DrivingLicenseDto,
  VehicleRcDto,
  PancardDto,
  AadhaarNumberDto,
} from './dto/pilot.dto';
import {
  VerificationResponseDL,
  VerificationResponseVehicle,
} from './interfaces/pilot.interface';
import { RideGateway } from '../ride/ride.gateway';
import formatDate from 'src/common/functions/formatDate';
import { VerifyAadhaarDto } from './dto/pilot.dto';

@Injectable()
export class PilotService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly azureServicce: AzureService,
    private readonly verificationService: VerificationService,
    private readonly rideGateway: RideGateway,
  ) {}

  async getPilot(userId: string) {
    try {
      const data = await this.prisma.pilot.findUnique({
        where: { userId },
        include: {
          user: true,
          language: true,
          drivingLicense: true,
        },
      });

      this.rideGateway.server.emit('test', {
        message: 'This is test event',
      });

      if (!data) {
        throw new NotFoundException('Pilot not found.');
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
      // if (!pilot.selfieUrl) {
      //   throw new BadRequestException('Driver does not have Live selfie.');
      // }

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
      // if (!pilot.selfieUrl) {
      //   throw new BadRequestException('Driver does not have Live selfie.');
      // }

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
      // if (!pilot.isPanCardVerified) {
      //   throw new BadRequestException('Driver does not have pancard verfied.');
      // }

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
      // if (!pilot.isPanCardVerified) {
      //   throw new BadRequestException('Driver does not have pancard verfied.');
      // }

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

      const subscription = await this.prisma.pilotSubscription.findUnique({
        where: { name: 'Flexi Pack' },
      });

      // Create pilot wallet
      const data = await this.prisma.pilotWallet.create({
        data: {
          pilotId: pilot.id,
          balance: subscription.coins,
          subscriptionId: subscription.id,
        },
      });

      return {
        message: 'Pilot onboarding coins availed successfully.',
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

    let vehicleType;

    vehicleType = await this.prisma.vehicleType.findFirst({
      where: {
        name: category,
      },
    });

    const vehicle = await this.prisma.vehicle.create({
      data: {
        pilotId,
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
        vehicleTypeId: vehicleType.id,
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
