import {
  Injectable,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from 'src/core/database/prisma.service';
import { AzureService } from 'src/core/utils/azure.util';
import { SignzyService } from 'src/core/utils/signzy.util';
import { DrivingLicenseDto, VehicleRcDto, PancardDto } from './dto/pilot.dto';
import {
  VerificationResponseDL,
  VerificationResponseVehicle,
} from './interfaces/pilot.interface';
import { ConfigService } from '@nestjs/config';
import { RideGateway } from '../ride/ride.gateway';
import formatDate from 'src/common/functions/formatDate';

@Injectable()
export class PilotService {
  private readonly onboardingOffer: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly azureServicce: AzureService,
    private readonly signzyService: SignzyService,
    private readonly configService: ConfigService,
    private readonly rideGateway: RideGateway,
  ) {
    this.onboardingOffer = this.configService.get<string>('onboardingOffer');
  }

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

      return {
        message: 'Pilot fetched successfully',
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
        throw new BadRequestException('Pilot not found.');
      }

      if (!file) {
        throw new BadRequestException('No file provided.');
      }

      const buffer = file.buffer;

      // Extract text using Azure OCR
      const lines = await this.getOcrResult(buffer);

      const extractedData = this.parseLicenseData(lines);

      const rawResponse = await this.signzyService.verifyDrivingLicense(
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
        throw new BadRequestException('Pilot not found.');
      }

      drivingLicenseNumber = drivingLicenseNumber.split(' ').join('');
      const rawResponse = await this.signzyService.verifyDrivingLicense(
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

      if (pilot.selfieUrl) {
        throw new ForbiddenException('Live selfie can be uploaded only once');
      }
      if (!pilot.isDLVerified) {
        throw new ForbiddenException(
          'Driving License must be verified before uploading Live selfie',
        );
      }

      const fileUrl = file.azureFileUrl;

      if (fileUrl) {
        await this.prisma.pilot.update({
          where: { userId },
          data: { selfieUrl: fileUrl },
        });
      }

      return { message: 'Live selfie uploaded successfully' };
    } catch (error) {
      console.error(error);
      throw error;
    }
  }

  async processVehicleRC(file: Express.Multer.File, userId: string) {
    try {
      const pilot = await this.prisma.pilot.findUnique({ where: { userId } });
      if (!pilot) {
        throw new BadRequestException('Pilot not found.');
      }
      if (!pilot.selfieUrl) {
        throw new BadRequestException('Driver does not have Live selfie');
      }

      if (!file) {
        throw new BadRequestException('No file provided.');
      }
      const buffer = file.buffer;

      // Extract text using Azure OCR
      const lines = await this.getOcrResult(buffer);

      const registrationNumber = this.extractRegistrationNumber(lines);

      if (!registrationNumber) {
        throw new BadRequestException(
          'Could not extract vehicle registration number from the image',
        );
      }

      const verificationResponse: VerificationResponseVehicle =
        await this.signzyService.verifyVehicleRC(registrationNumber);

      if (verificationResponse.status.toLowerCase() !== 'active') {
        throw new BadRequestException(
          'vehicle registration number is not active',
        );
      }

      if (
        !verificationResponse.isrcExpired ||
        !verificationResponse.ispermitExpired
      ) {
        return {
          message: 'Vehicle registration or permit is expired',
          data: {
            ...verificationResponse,
            id: null,
            pilotId: null,
            regNo: null,
            vehicleTypeId: null,
            createdAt: null,
            updatedAt: null,
          },
        };
      }

      const data = await this.updatePilotVehicleData(
        verificationResponse,
        pilot.id,
      );

      return {
        message: 'Vehicle RC processed successfully',
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
        throw new BadRequestException('Driver does not have Live selfie');
      }

      let { registrationNumber } = vehicleRcDto;

      registrationNumber = registrationNumber.split(' ').join('');

      const verificationResponse: VerificationResponseVehicle =
        await this.signzyService.verifyVehicleRC(registrationNumber);

      if (verificationResponse.status.toLowerCase() !== 'active') {
        throw new BadRequestException(
          'vehicle registration number is not active',
        );
      }

      const data = await this.updatePilotVehicleData(
        verificationResponse,
        pilot.id,
      );

      return {
        message: 'Vehicle RC processed successfully',
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
        throw new BadRequestException('Driver does not have rc verfied');
      }

      if (!file) {
        throw new BadRequestException('No file provided.');
      }

      const buffer = file.buffer;

      // Extract text using Azure OCR
      const lines = await this.getOcrResult(buffer);

      const panNumber = this.extractPancardData(lines);

      if (!panNumber) {
        throw new BadRequestException(
          'Could not extract pan card number from the image',
        );
      }

      const verificationResponse =
        await this.signzyService.verifyPancard(panNumber);

      if (verificationResponse.panStatus.toLowerCase() !== 'valid') {
        throw new BadRequestException(
          'This pan card is either non-existing or invalid',
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
        message: 'Pancard verified successfully',
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
        throw new BadRequestException('Driver does not have rc verfied');
      }

      const { panNumber } = pancardDto;

      const verificationResponse =
        await this.signzyService.verifyPancard(panNumber);

      if (verificationResponse.panStatus.toLowerCase() !== 'valid') {
        throw new BadRequestException(
          'This pan card is either non-existing or invalid',
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
        message: 'Pancard verified successfully',
        data,
      };
    } catch (error) {
      console.error(error);
      throw error;
    }
  }

  async pilotonboardingOffer(userId: string) {
    try {
      const pilot = await this.prisma.pilot.findUnique({ where: { userId } });

      const subscription = await this.prisma.pilotSubscription.findUnique({
        where: { name: this.onboardingOffer },
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
        message: 'Pilot onboarding coins availed successfully',
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
      throw new BadRequestException(
        'Unable to process the image. Please provide the Driving License number and Date of Birth manually.',
      );
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

  private extractRegistrationNumber(lines: any[]): string | null {
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

  private extractPancardData(lines: any[]) {
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
  private async updatePilotVehicleData(
    verificationResponse: VerificationResponseVehicle,
    pilotId: string,
  ) {
    const {
      regNo,
      regUpto,
      permitUpto,
      status,
      insuranceUpto,
      manufacturer,
      model,
      colour,
      fitUpto,
      puccUpto,
      state,
    } = verificationResponse;

    const vehicleType = await this.prisma.vehicleType.findFirst({
      where: {
        name: 'Sedan',
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
        'Pancard name does not match with driving license name',
      );
    }
  }
}
