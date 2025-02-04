import {
  Injectable,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from 'src/core/database/prisma.service';
import { RoleEnum } from '../auth/dto/auth.dto';
import { AzureService } from 'src/core/utils/azure.util';
import { SignzyService } from 'src/core/utils/signzy.util';
import { DrivingLicenseDto, VehicleRcDto, PancardDto } from './dto/pilot.dto';
import {
  VerificationResponseDL,
  VerificationResponseVehicle,
} from './interfaces/pilot.interface';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class PilotService {
  private readonly onboardingOffer: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly azureServicce: AzureService,
    private readonly signzyService: SignzyService,
    private readonly configService: ConfigService,
  ) {
    this.onboardingOffer = this.configService.get<string>('onboardingOffer');
  }

  async getPilot(userId: string) {
    const pilot = await this.prisma.pilot.findUnique({
      where: { userId },
      include: {
        user: true,
        language: true,
      },
    });

    return {
      message: 'Pilot fetched successfully',
      data: pilot,
    };
  }

  async processDrivingLicense(file: Express.Multer.File, userId: string) {
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

    const data = await this.updatePilotDrivingLiceseData(
      verificationResponse,
      userId,
    );

    return {
      message: 'Driving license processed successfully.',
      data,
    };
  }

  async processManualDrivingLicense(
    drivingLicenseAndDobDto: DrivingLicenseDto,
    userId: string,
  ) {
    const { drivingLicenseNumber, dob } = drivingLicenseAndDobDto;

    const pilot = await this.prisma.pilot.findUnique({ where: { userId } });
    if (!pilot) {
      throw new BadRequestException('Pilot not found.');
    }

    const rawResponse = await this.signzyService.verifyDrivingLicense(
      drivingLicenseNumber,
      dob,
    );

    const verificationResponse: VerificationResponseDL =
      this.transformResponseDL(rawResponse);

    const data = await this.updatePilotDrivingLiceseData(
      verificationResponse,
      userId,
    );

    return {
      message: 'Driving license processed successfully.',
      data,
    };
  }

  async uploadLiveSelfie(
    file: Express.Multer.File,
    userId: string,
    role: string,
  ) {
    if (role !== RoleEnum.PILOT) {
      throw new BadRequestException('Only Pilot can upload live selfie');
    }

    const pilot = await this.prisma.pilot.findUnique({ where: { userId } });
    if (pilot.selfieUrl) {
      throw new ForbiddenException('Live selfie can be uploaded only once');
    }
    if (!pilot.isDLVerified) {
      throw new ForbiddenException(
        'Driving License must be verified before uploading Live selfie',
      );
    }

    // file was uploaded by the azure service with file interceptor
    const fileUrl = file.azureFileUrl;

    if (fileUrl) {
      await this.prisma.pilot.update({
        where: { userId },
        data: { selfieUrl: fileUrl },
      });
    }

    return { message: 'Live selfie uploaded successfully' };
  }

  async processVehicleRC(file: Express.Multer.File, userId: string) {
    const pilot = await this.prisma.pilot.findUnique({ where: { userId } });
    if (!pilot) {
      throw new BadRequestException('Pilot not found.');
    }
    if (!pilot.selfieUrl) {
      throw new BadRequestException('Live selfie not found.');
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

    const rawResponse =
      await this.signzyService.verifyVehicleRC(registrationNumber);

    const verificationResponse: VerificationResponseVehicle =
      this.transformResponseVehicle(rawResponse);

    if (verificationResponse.status !== 'Active') {
      throw new BadRequestException(
        'vehicle registration number is not active',
      );
    }

    const vehicle = await this.updatePilotVehicleData(
      verificationResponse,
      userId,
    );

    return {
      message: 'Vehicle RC processed successfully',
      data: vehicle,
    };
  }

  async processManualVehicleRC(vehicleRcDto: VehicleRcDto, userId: string) {
    const { registrationNumber } = vehicleRcDto;

    const rawResponse =
      await this.signzyService.verifyVehicleRC(registrationNumber);

    const verificationResponse: VerificationResponseVehicle =
      this.transformResponseVehicle(rawResponse);

    if (verificationResponse.status !== 'Active') {
      throw new BadRequestException(
        'vehicle registration number is not active',
      );
    }

    const vehicle = await this.updatePilotVehicleData(
      verificationResponse,
      userId,
    );

    return {
      message: 'Vehicle RC processed successfully',
      data: vehicle,
    };
  }

  async processPancard(file: Express.Multer.File, userId: string) {
    if (!file) {
      throw new BadRequestException('No file provided.');
    }

    const buffer = file.buffer;
  }

  async processManualPancard(pancardDto: PancardDto, userId: string) {
    const { pan, name, dob } = pancardDto;

    const verificationResponse = await this.signzyService.verifyPancard(
      pan,
      name,
      dob,
    );

    // E - Existing and Valid
    if (verificationResponse.panStatus !== 'E') {
      throw new BadRequestException(
        'This pan card is either non-existing or invalid',
      );
    }

    const pilot = await this.prisma.pilot.update({
      where: { userId },
      data: {
        isPanCardVerified: true,
      },
    });

    return {
      message: 'Pancard verified successfully',
      pilot,
    };
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
        // 6 -> DL No -> 5 characters including space + space
        data.dlNumber = text.substring(6).replace(' ', '');
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

  private parseDate(dateString: string): Date {
    if (!dateString) {
      throw new Error('Invalid date string');
    }

    const [day, month, year] = dateString.split('/');
    if (!day || !month || !year) {
      throw new Error('Invalid date components');
    }

    // Reformat the date to YYYY-MM-DD
    const formattedDate = `${year}-${month}-${day}`;
    const parsedDate = new Date(formattedDate);

    if (isNaN(parsedDate.getTime())) {
      throw new Error('Failed to parse date');
    }

    return parsedDate;
  }

  private transformResponseDL(rawResponse: any) {
    return {
      licenseNumber: rawResponse.dlNumber,
      dateOfBirth: this.parseDate(rawResponse.dob),
      nameOnLicense: rawResponse.detailsOfDrivingLicence.name,
      dateOfIssue: this.parseDate(
        rawResponse.detailsOfDrivingLicence.dateOfIssue,
      ),
      validUntill: this.parseDate(rawResponse.dlValidity.transport.to),
    };
  }

  private async updatePilotDrivingLiceseData(
    verificationResponse: VerificationResponseDL,
    userId: string,
  ) {
    const {
      licenseNumber,
      nameOnLicense,
      dateOfIssue,
      validUntill,
      dateOfBirth,
    } = verificationResponse;

    // Update Pilot record in the database
    const pilot = await this.prisma.pilot.update({
      where: { userId },
      data: {
        isDLVerified: true,
      },
    });

    // Create Driving License record in the database
    const drivingLicense = await this.prisma.drivingLicense.create({
      data: {
        licenseNumber,
        nameOnLicense,
        dateOfIssue,
        validUntill,
        dateOfBirth,
        pilotId: pilot.id,
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

  private transformResponseVehicle(rawResponse: any) {
    return {
      regNo: rawResponse.regNo,
      status: rawResponse.status,
      fitUpto: this.parseDate(rawResponse.fitUpto),
      puccUpto: this.parseDate(rawResponse.puccUpto),
      makerModel: rawResponse.makerModel,
      vehicleColour: rawResponse.vehicleColour,
      type: rawResponse.desc,
    };
  }

  private async updatePilotVehicleData(
    verificationResponse: VerificationResponseVehicle,
    userId: string,
  ) {
    const {
      type,
      fitUpto,
      puccUpto,
      regNo,
      status,
      makerModel,
      vehicleColour,
    } = verificationResponse;

    // Update pilot record with vehicle information
    const pilot = await this.prisma.pilot.update({
      where: { userId },
      data: {
        isRCVerified: true,
      },
    });

    const vehicleType = await this.prisma.vehicleType.upsert({
      where: { name: type },
      update: {},
      create: { name: type },
    });

    // Create vehicle record
    const vehicle = await this.prisma.vehicle.create({
      data: {
        fitUpto,
        puccUpto,
        pilotId: pilot.id,
        vehicleTypeId: vehicleType.id,
        regNo,
        status,
        makerModel,
        vehicleColour,
      },
    });

    return vehicle;
  }

  private async pilotonboardingSetup(pilotId: string) {
    const subscription = await this.prisma.pilotSubscription.findUnique({
      where: { name: this.onboardingOffer },
    });

    // Create pilot wallet
    const wallet = await this.prisma.pilotWallet.create({
      data: {
        pilotId,
        balance: subscription.coins,
        subscriptionId: subscription.id,
      },
    });
  }
}
