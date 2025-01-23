import {
  Injectable,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from 'src/core/database/prisma.service';
import { RoleEnum } from '../auth/dto/auth.dto';
import { AzureService } from 'src/core/utils/azure.util';
import { SignzyService } from 'src/core/utils/signzy.util';
import { DrivingLicenseAndDboDto, PancardDto } from './dto/pilot.dto';
import * as Tesseract from 'tesseract.js';

@Injectable()
export class PilotService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly azureServicce: AzureService,
    private readonly signzyService: SignzyService,
  ) {}

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

    const fileUrl = file.azureFileUrl;

    if (fileUrl) {
      await this.prisma.pilot.update({
        where: { userId },
        data: { selfieUrl: fileUrl },
      });
    }

    return { message: 'Live selfie uploaded successfully' };
  }

  async processDrivingLicense(file: Express.Multer.File, userId: string) {
    if (!file) {
      throw new BadRequestException('No file provided.');
    }

    const buffer = file.buffer;

    // Extract text using Azure OCR
    const lines = await this.getOcrResult(buffer);

    const extractedData = this.parseLicenseData(lines);

    const verificationResponse = await this.signzyService.verifyDrivingLicense(
      extractedData.dlNumber,
      extractedData.dateOfBirth.split(': ')[1],
    );

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
    drivingLicenseAndDobDto: DrivingLicenseAndDboDto,
    userId: string,
  ) {
    const { drivingLicenseNumber, dob } = drivingLicenseAndDobDto;

    const verificationResponse = await this.signzyService.verifyDrivingLicense(
      drivingLicenseNumber,
      dob,
    );

    const data = await this.updatePilotDrivingLiceseData(
      verificationResponse,
      userId,
    );

    return {
      message: 'Driving license processed successfully.',
      data,
    };
  }

  async processVehicleRC(file: Express.Multer.File, userId: string) {
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

    const verificationResponse =
      await this.signzyService.verifyVehicleRC(registrationNumber);

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

    const text = await this.extractTextUsingTesseract(buffer);
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
        providedPanCard: true,
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
      if (text.includes('DL No')) {
        const dlIndex = text.indexOf('DL No');
        const temp = text.substring(dlIndex + 6).trim(); // Extract everything after 'DL No'
        data.dlNumber = temp.split(' ').join('');
      }

      // Extract Date of Birth (DOB)
      if (text.startsWith('DOB')) {
        const dobIndex = text.indexOf('DOB');
        data.dateOfBirth = text.substring(dobIndex + 4).trim(); // Extract everything after 'DOB:'
      }
    }

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

  private async updatePilotDrivingLiceseData(
    verificationResponse: any,
    userId,
  ) {
    const issueDate = this.parseDate(
      verificationResponse.dlValidity.nonTransport.from,
    );
    const validTill = this.parseDate(
      verificationResponse.dlValidity.nonTransport.to,
    );
    const dateOfBirth = this.parseDate(verificationResponse.dob);

    // Update Pilot record in the database
    const pilot = await this.prisma.pilot.update({
      where: { userId },
      data: {
        drivingLicenseNumber: verificationResponse.dlNumber,
        drivingLicenseName: verificationResponse.detailsOfDrivingLicence.name,
        issueDate,
        validTill,
        dateOfBirth,
        providedDrivingLicense: true,
      },
    });

    return pilot;
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

  private async updatePilotVehicleData(
    verificationResponse: any,
    userId: string,
  ) {
    // Update pilot record with vehicle information
    const pilot = await this.prisma.pilot.update({
      where: { userId },
      data: {
        providedRC: true,
      },
    });

    const vehicle = await this.prisma.vehicle.create({
      data: {
        rcNumber: verificationResponse.regNo,
        model: verificationResponse.makerModel,
        color: verificationResponse.vehicleColour,
        pilotId: pilot.id,
      },
      include: {
        pilot: true,
      },
    });

    return vehicle;
  }

  private async extractTextUsingTesseract(buffer: Buffer): Promise<string> {
    try {
      const result = await Tesseract.recognize(buffer, 'eng');

      return result.data.text; // Extracted text
    } catch (error) {
      console.error('Tesseract OCR Error:', error);
      throw new Error('Failed to extract text using Tesseract.');
    }
  }
}
