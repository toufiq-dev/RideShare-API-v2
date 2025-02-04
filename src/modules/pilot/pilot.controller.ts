import {
  Controller,
  HttpCode,
  UseGuards,
  UseInterceptors,
  Get,
  Post,
  UploadedFile,
  Body,
} from '@nestjs/common';
import { PilotService } from './pilot.service';
import { JwtAuthGuard } from 'src/common/guards/current-user.guard';
import { CurrentUser } from 'src/common/decorators/user.decorator';
import { ApiBearerAuth, ApiBody, ApiOperation } from '@nestjs/swagger';
import { CustomFileInterceptor } from 'src/common/interceptors/file.interceptor';
import { FileInterceptor } from '@nestjs/platform-express';
import { DrivingLicenseDto, PancardDto, VehicleRcDto } from './dto/pilot.dto';

@Controller('pilot')
export class PilotController {
  constructor(private readonly pilotService: PilotService) {}

  @Get()
  @HttpCode(200)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get pilot' })
  async getPilot(@CurrentUser('userId') userId: string) {
    return await this.pilotService.getPilot(userId);
  }

  @Post('driving-license')
  @HttpCode(200)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Upload driving license of pilot' })
  @UseInterceptors(FileInterceptor('file'))
  async uploadDrivingLicense(
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser('userId') userId: string,
  ) {
    return await this.pilotService.processDrivingLicense(file, userId);
  }

  @Post('manual/driving-license')
  @HttpCode(200)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Manually give driving license and dob of pilot' })
  @ApiBody({ type: DrivingLicenseDto })
  async drivingLicenseAndDob(
    @Body() drivingLicenseAndDobDto: DrivingLicenseDto,
    @CurrentUser('userId') userId: string,
  ) {
    return await this.pilotService.processManualDrivingLicense(
      drivingLicenseAndDobDto,
      userId,
    );
  }

  @Post('live-selfie')
  @HttpCode(200)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Upload live selfie for pilot' })
  @UseInterceptors(CustomFileInterceptor)
  async uploadLiveSelfie(
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser('userId') userId: string,
    @CurrentUser('role') role: string,
  ) {
    return await this.pilotService.uploadLiveSelfie(file, userId, role);
  }

  @Post('vehicle-rc')
  @HttpCode(200)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Upload Vehicle RC' })
  @UseInterceptors(FileInterceptor('file'))
  async uploadVehicleRC(
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser('userId') userId: string,
  ) {
    return await this.pilotService.processVehicleRC(file, userId);
  }

  @Post('manual/vehicle-rc')
  @HttpCode(200)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Upload Vehicle RC' })
  @ApiBody({ type: VehicleRcDto })
  async uploadVehicleRCManual(
    @Body() vehicleRcDto: VehicleRcDto,
    @CurrentUser('userId') userId: string,
  ) {
    return await this.pilotService.processManualVehicleRC(vehicleRcDto, userId);
  }

  @Post('pancard')
  @HttpCode(200)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Upload Pancard of pilot' })
  @UseInterceptors(FileInterceptor('file'))
  async uploadPanCard(
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser('userId') userId: string,
  ) {
    return await this.pilotService.processPancard(file, userId);
  }

  @Post('manual/pancard')
  @HttpCode(200)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Manually give Pancard of pilot' })
  @ApiBody({ type: PancardDto })
  async verifyPanCard(
    @Body() pancardDto: PancardDto,
    @CurrentUser('userId') userId: string,
  ) {
    return await this.pilotService.processManualPancard(pancardDto, userId);
  }
}
