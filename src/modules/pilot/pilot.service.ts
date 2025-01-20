import { Injectable, UnauthorizedException } from '@nestjs/common';
import { AzureBlobService } from 'src/core/utils/azure-blob.util';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from 'src/core/database/prisma.service';
import { RoleEnum } from '../auth/dto/auth.dto';

@Injectable()
export class PilotService {
  private readonly allowedMimeTypes: string[];
  constructor(
    private readonly azureBlobService: AzureBlobService,
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    this.allowedMimeTypes = this.configService.get<string[]>(
      'azure.allowedMimeTypes',
    );
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

  async uploadLiveSelfie(
    file: Express.Multer.File,
    userId: string,
    role: string,
  ) {
    const { buffer, originalname, mimetype } = file;

    if (role !== RoleEnum.PILOT) {
      throw new UnauthorizedException('Only Pilot can upload live selfie');
    }

    const pilot = await this.prisma.pilot.findUnique({ where: { userId } });

    if (pilot.selfieUrl) {
      throw new UnauthorizedException('Live selfie can be uploaded only once');
    }

    const fileUrl = await this.azureBlobService.uploadFile(
      buffer,
      originalname,
      userId,
      mimetype,
    );

    if (fileUrl) {
      await this.prisma.pilot.update({
        where: { userId },
        data: { selfieUrl: fileUrl },
      });
    }

    return { message: 'Live selfie uploaded successfully' };
  }
}
