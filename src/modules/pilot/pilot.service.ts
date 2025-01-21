import {
  Injectable,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from 'src/core/database/prisma.service';
import { RoleEnum } from '../auth/dto/auth.dto';
import { AzureService } from 'src/core/utils/azure.util';
import { SignzyService } from 'src/core/utils/signzy.util';
import { DrivingLicenseAndDboDto } from './dto/pilot.dto';

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
    const ocrResult = await this.azureServicce.extractTextFromImage(buffer);
    let lines;
    if (ocrResult) {
      lines = ocrResult.analyzeResult.readResults[0].lines;
    } else {
      throw new BadRequestException(
        'Unable to process image, please provide the Driving License number and Date of Birth in below fields',
      );
    }
    const extractedData = this.parseLicenseData(lines);

    const verificationResponse = await this.signzyService.verifyDrivingLicense(
      extractedData.dlNumber,
      extractedData.dateOfBirth.split(': ')[1],
    );

    const data = await this.updatePilotDrivingLiceseData(verificationResponse, userId)

    return {
      message: 'Driving license processed successfully.',
      data,
    };
  }

  async processManualDrivingLicense(
    drivingLicenseAndDobDto: DrivingLicenseAndDboDto,
    userId: string,
  ) {
    const {drivingLicenseNumber, dob} = drivingLicenseAndDobDto

    const verificationResponse = await this.signzyService.verifyDrivingLicense(drivingLicenseNumber, dob)

    const data = await this.updatePilotDrivingLiceseData(verificationResponse, userId)

    return {
      message: 'Driving license processed successfully.',
      data,
    };
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

  private async updatePilotDrivingLiceseData(verificationResponse: any, userId) {
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

    return pilot
  }
}
