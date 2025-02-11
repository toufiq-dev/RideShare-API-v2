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
import * as moment from 'moment-timezone';
import formatDate from 'src/common/functions/formatDate';

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
    const data: any = await this.prisma.$queryRaw`
      SELECT "id", "userId", "phone", ST_AsText("currentLocation") AS location, "isAvailable"
      FROM "Pilot"
      WHERE "userId" = ${userId}
      LIMIT 1;
    `;

    if (data.length === 0) {
      throw new BadRequestException('Pilot not found.');
    }

    return {
      message: 'Pilot fetched successfully',
      data: data[0],
    };
  }

  async processDrivingLicense(file: Express.Multer.File, userId: string) {
    await this.findPilot(userId);

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
    let { drivingLicenseNumber, dob } = drivingLicenseAndDobDto;

    await this.findPilot(userId);

    drivingLicenseNumber = drivingLicenseNumber.split(' ').join('');
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

  async uploadLiveSelfie(file: Express.Multer.File, userId: string) {
    const pilot = await this.findPilot(userId);

    if (pilot[0].selfieUrl) {
      throw new ForbiddenException('Live selfie can be uploaded only once');
    }

    if (!pilot[0].isDLVerified) {
      throw new ForbiddenException(
        'Driving License must be verified before uploading Live selfie',
      );
    }

    // file was uploaded by the azure service with file interceptor
    const fileUrl = file.azureFileUrl;

    if (fileUrl) {
      await this.prisma.$queryRaw`
        UPDATE "Pilot" 
        SET "selfieUrl" = ${fileUrl} 
        WHERE "userId" = ${userId};
      `;
    }

    return { message: 'Live selfie uploaded successfully' };
  }

  async processVehicleRC(file: Express.Multer.File, userId: string) {
    const pilot = await this.findPilot(userId);

    if (!pilot[0].selfieUrl) {
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

    // Check if vehicle registration number is expired
    this.isVehicleRegistrationNumberExpired(verificationResponse.rcExpiryDate);

    const data = await this.updatePilotVehicleData(
      verificationResponse,
      userId,
    );

    return {
      message: 'Vehicle RC processed successfully',
      data,
    };
  }

  async processManualVehicleRC(vehicleRcDto: VehicleRcDto, userId: string) {
    let { registrationNumber } = vehicleRcDto;

    await this.findPilot(userId);

    registrationNumber = registrationNumber.split(' ').join('');

    const verificationResponse: VerificationResponseVehicle =
      await this.signzyService.verifyVehicleRC(registrationNumber);

    if (verificationResponse.status.toLowerCase() !== 'active') {
      throw new BadRequestException(
        'vehicle registration number is not active',
      );
    }

    // Check if vehicle registration number is expired
    this.isVehicleRegistrationNumberExpired(verificationResponse.rcExpiryDate);

    const data = await this.updatePilotVehicleData(
      verificationResponse,
      userId,
    );

    return {
      message: 'Vehicle RC processed successfully',
      data,
    };
  }

  async processPancard(file: Express.Multer.File, userId: string) {
    await this.findPilot(userId);

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

    const data = await this.prisma.$queryRaw`
      UPDATE "Pilot" 
      SET "isPanCardVerified" = true 
      WHERE "userId" = ${userId};
    `;

    return {
      message: 'Pancard verified successfully',
      data: data[0],
    };
  }

  async processManualPancard(pancardDto: PancardDto, userId: string) {
    const { panNumber } = pancardDto;

    await this.findPilot(userId);

    const verificationResponse =
      await this.signzyService.verifyPancard(panNumber);

    if (verificationResponse.panStatus.toLowerCase() !== 'valid') {
      throw new BadRequestException(
        'This pan card is either non-existing or invalid',
      );
    }

    // await this.verifyPancardName(verificationResponse, userId);

    const data = await this.prisma.$queryRaw`
      UPDATE "Pilot" 
      SET "isPanCardVerified" = true 
      WHERE "userId" = ${userId};
    `;

    return {
      message: 'Pancard verified successfully',
      data: data[0],
    };
  }

  async pilotonboardingOffer(userId: string) {
    const pilot = await this.findPilot(userId);

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
  }

  private async findPilot(userId: string) {
    const pilot: any = await this.prisma.$queryRaw`
      SELECT "id" FROM "Pilot" WHERE "userId" = ${userId} LIMIT 1;
    `;
    if (!pilot) {
      throw new BadRequestException('Pilot not found.');
    }

    return pilot;
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
    userId: string,
  ) {
    const {
      licenseNumber,
      nameOnLicense,
      dateOfIssue,
      validUntill,
      dateOfBirth,
    } = verificationResponse;

    const pilot = await this.findPilot(userId);
    console.log(pilot);

    // Insert driving license data
    const drivingLicense = await this.prisma.drivingLicense.create({
      data: {
        licenseNumber,
        nameOnLicense,
        dateOfIssue,
        validUntill,
        dateOfBirth,
        pilotId: pilot[0].id,
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

  private isVehicleRegistrationNumberExpired(rcExpiryDate) {
    const expiryDateUTC = moment.utc(rcExpiryDate);
    const nowUTC = moment.utc();
    const expiryDateIST = expiryDateUTC.tz('Asia/Kolkata');
    const nowIST = nowUTC.tz('Asia/Kolkata');
    if (expiryDateIST.isBefore(nowIST)) {
      throw new BadRequestException('Vehicle registration number is expired');
    }
  }

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
    userId: string,
  ) {
    const {
      regNo,
      status,
      insuranceUpto,
      manufacturer,
      makerModel,
      vehicleColour,
      fitUpto,
      puccUpto,
      rcExpiryDate,
      permitUpto,
      vehicleState,
      vehicleSeatingCapacity,
      vehicleClass,
    } = verificationResponse;

    // Update pilot record with vehicle information
    const pilot = await this.prisma.$queryRaw`
      UPDATE "Pilot" 
      SET "isRCVerified" = true 
      WHERE "userId" = ${userId};
    `;

    // const vehicleType = await this.prisma.vehicleType.findUnique({ where: { name: vehicleClass } });

    // Create vehicle record
    const vehicle = await this.prisma.$queryRaw`
      INSERT INTO "Vehicle" ("pilotId", "regNo", "status", "regUpto", "permitUpto", "fitUpto", "puccUpto", "insuranceUpto", "makerModel", "vehicleColour", "manufacturer", "vehicleState", "vehicleSeatingCapacity", "vehicleTypeId")
      VALUES (${pilot[0].id}, ${verificationResponse.regNo}, ${verificationResponse.status}, ${verificationResponse.rcExpiryDate}, ${verificationResponse.permitUpto}, ${verificationResponse.fitUpto}, ${verificationResponse.puccUpto}, ${verificationResponse.insuranceUpto}, ${verificationResponse.makerModel}, ${verificationResponse.vehicleColour}, ${verificationResponse.manufacturer}, ${verificationResponse.vehicleState}, ${verificationResponse.vehicleSeatingCapacity}, ${'Kali Peeli'} LIMIT 1));
    `;

    return vehicle[0];
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
