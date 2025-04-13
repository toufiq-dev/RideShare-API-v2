import {
  Controller,
  HttpCode,
  UseGuards,
  UseInterceptors,
  Get,
  Post,
  UploadedFile,
  Body,
  DefaultValuePipe,
  ParseIntPipe,
  Query,
} from '@nestjs/common';
import { PilotService } from './pilot.service';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { CurrentUser } from 'src/common/decorators/user.decorator';
import { ApiBearerAuth, ApiBody, ApiOperation } from '@nestjs/swagger';
import { CustomFileInterceptor } from 'src/common/interceptors/file.interceptor';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  AadhaarNumberDto,
  VerifyAadhaarDto,
  DrivingLicenseDto,
  PancardDto,
  VehicleRcDto,
  BeOnlineDto,
  AcceptRideDto,
} from './dto/pilot.dto';
import { Roles } from 'src/common/decorators/roles.decorator';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { RoleEnum } from 'src/modules/auth/dto/auth.dto';
import { VerifyPhoneDto } from 'src/common/dto/common.dto';

@Controller('pilot')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(RoleEnum.PILOT)
export class PilotController {
  constructor(private readonly pilotService: PilotService) {}

  @Get()
  @HttpCode(200)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get pilot' })
  async getPilot(@CurrentUser('userId') userId: string) {
    return await this.pilotService.getPilot(userId);
  }

  @Post('phone/otp')
  @HttpCode(200)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Send otp to Update phone' })
  async updatePhone(@CurrentUser('userId') userId: string) {
    return await this.pilotService.updatePhone(userId);
  }

  @Post('phone/verify')
  @HttpCode(200)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update phone' })
  async verifyPhone(
    @Body() verifyCustomerPhoneDto: VerifyPhoneDto,
    @CurrentUser('userId') userId: string,
  ) {
    return await this.pilotService.verifyPhone(userId, verifyCustomerPhoneDto);
  }

  @Post('driving-license')
  @HttpCode(200)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Upload driving license of pilot' })
  @UseInterceptors(FileInterceptor('file'))
  async uploadDrivingLicense(
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser('userId') userId: string,
  ) {
    return await this.pilotService.processDrivingLicense(file, userId);
  }

  @Post('driving-license/manual')
  @HttpCode(200)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Manually give driving license and dob of pilot' })
  @ApiBody({ type: DrivingLicenseDto })
  async verifyDrivingLicense(
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
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Upload live selfie for pilot' })
  @UseInterceptors(CustomFileInterceptor)
  async uploadLiveSelfie(
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser('userId') userId: string,
    @CurrentUser('role') role: string,
  ) {
    return await this.pilotService.uploadLiveSelfie(file, userId);
  }

  @Post('vehicle-rc')
  @HttpCode(200)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Upload Vehicle RC' })
  @UseInterceptors(FileInterceptor('file'))
  async uploadVehicleRC(
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser('userId') userId: string,
  ) {
    return await this.pilotService.processVehicleRC(file, userId);
  }

  @Post('vehicle-rc/manual')
  @HttpCode(200)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Manually give Vehicle RC' })
  @ApiBody({ type: VehicleRcDto })
  async verifyVehicleRC(
    @Body() vehicleRcDto: VehicleRcDto,
    @CurrentUser('userId') userId: string,
  ) {
    return await this.pilotService.processManualVehicleRC(vehicleRcDto, userId);
  }

  @Post('pancard')
  @HttpCode(200)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Upload Pancard of pilot' })
  @UseInterceptors(FileInterceptor('file'))
  async uploadPanCard(
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser('userId') userId: string,
  ) {
    return await this.pilotService.processPancard(file, userId);
  }

  @Post('pancard/manual')
  @HttpCode(200)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Manually give Pancard of pilot' })
  @ApiBody({ type: PancardDto })
  async verifyPanCard(
    @Body() pancardDto: PancardDto,
    @CurrentUser('userId') userId: string,
  ) {
    return await this.pilotService.processManualPancard(pancardDto, userId);
  }

  @Post('aadhaar')
  @HttpCode(200)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Upload Aadhaar card verification document' })
  @UseInterceptors(FileInterceptor('file'))
  async uploadAadhaar(
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser('userId') userId: string,
  ) {
    return await this.pilotService.processAadhaar(file, userId);
  }

  @Post('aadhaar/manual')
  @HttpCode(200)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Aadhaar card verification' })
  @ApiBody({ type: VerifyAadhaarDto })
  async sendOtpAadhaar(
    @Body() aadhaarNumberDto: AadhaarNumberDto,
    @CurrentUser('userId') userId: string,
  ) {
    return await this.pilotService.processAadhaarManual(
      aadhaarNumberDto,
      userId,
    );
  }

  @Post('aadhaar/verify')
  @HttpCode(200)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Aadhaar card verification' })
  @ApiBody({ type: VerifyAadhaarDto })
  async verifyAadhaar(
    @Body() verifyAadhaarDto: VerifyAadhaarDto,
    @CurrentUser('userId') userId: string,
  ) {
    return await this.pilotService.verifyAadhaar(verifyAadhaarDto, userId);
  }

  @Get('onboarding-offer')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get Faircoins for onborading' })
  async getOnboardingOffer(@CurrentUser('userId') userId: string) {
    return await this.pilotService.onboardingOffer(userId);
  }

  @Get('vehicle/list')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get list of vehicles' })
  async getVehicles(@CurrentUser('userId') userId: string) {
    return await this.pilotService.getVehicles(userId);
  }

  @Get('transactions')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get list of transactions' })
  async getTransactions(
    @CurrentUser('userId') userId: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('pageSize', new DefaultValuePipe(10), ParseIntPipe) pageSize: number,
  ) {
    return await this.pilotService.getTransactions(userId, page, pageSize);
  }

  @Post('online')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Make Pilot available for trips' })
  async beOnline(
    @Body() beOnlineDto: BeOnlineDto,
    @CurrentUser('userId') userId: string,
  ) {
    return await this.pilotService.beOnline(userId, beOnlineDto);
  }

  @Post('accept-ride')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Accept a trip' })
  async acceptRide(
    @Body() acceptRideDto: AcceptRideDto,
    @CurrentUser('userId') userId: string,
  ) {
    return await this.pilotService.acceptRide(acceptRideDto, userId);
  }
}
