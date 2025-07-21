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
  UploadedFiles,
} from '@nestjs/common';
import { PilotService } from './pilot.service';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { CurrentUser } from 'src/common/decorators/user.decorator';
import { ApiBearerAuth, ApiBody, ApiOperation } from '@nestjs/swagger';
import { CustomFileInterceptor } from 'src/common/interceptors/file.interceptor';
import {
  FileFieldsInterceptor,
  FileInterceptor,
} from '@nestjs/platform-express';
import {
  AadhaarNumberDto,
  VerifyAadhaarDto,
  DrivingLicenseDto,
  PancardDto,
  VehicleRcDto,
  BeOnlineDto,
  BDLicenseDto,
  BDNidDto,
  BDRCDto,
  NumberPlateDto,
  FreeRechargeDto,
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

  @Post('free-recharge')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Avail a bonus recharge when eligible.' })
  @ApiBody({ type: FreeRechargeDto })
  async availBonusRecharge(
    @Body() freeREchargeDto: FreeRechargeDto,
    @CurrentUser('userId') userId: string,
  ) {
    return await this.pilotService.availBonusRecharge(freeREchargeDto, userId);
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
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('pageSize', new DefaultValuePipe(10), ParseIntPipe) pageSize: number,
  ) {
    return await this.pilotService.getTransactions(
      userId,
      startDate,
      endDate,
      page,
      pageSize,
    );
  }

  @Post('online')
  @HttpCode(200)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Make Pilot available for trips' })
  async beOnline(
    @Body() beOnlineDto: BeOnlineDto,
    @CurrentUser('userId') userId: string,
  ) {
    return await this.pilotService.beOnline(userId, beOnlineDto);
  }

  @Post('bd-license')
  @HttpCode(200)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Upload driving license photo' })
  @UseInterceptors(
    FileFieldsInterceptor([
      { name: 'front', maxCount: 1 },
      { name: 'back', maxCount: 1 },
    ]),
  )
  async uploadBDLicense(
    @UploadedFiles()
    files: { front: Express.Multer.File[]; back?: Express.Multer.File[] },
    @CurrentUser('userId') userId: string,
  ) {
    return await this.pilotService.uploadBDLicense(files, userId);
  }

  @Post('bd-license/confirmation')
  @HttpCode(200)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Manually give driving license and dob of pilot' })
  @ApiBody({ type: BDLicenseDto })
  async verifyBDLicense(
    @Body() bDLicenseDto: BDLicenseDto,
    @CurrentUser('userId') userId: string,
  ) {
    return await this.pilotService.processBDLicense(bDLicenseDto, userId);
  }

  @Post('bd-nid')
  @HttpCode(200)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Upload NID card photo' })
  @UseInterceptors(
    FileFieldsInterceptor([
      { name: 'front', maxCount: 1 },
      { name: 'back', maxCount: 1 },
    ]),
  )
  async uploadBDNid(
    @UploadedFiles()
    files: { front: Express.Multer.File[]; back: Express.Multer.File[] },
    @CurrentUser('userId') userId: string,
  ) {
    return await this.pilotService.uploadBDNid(files, userId);
  }

  @Post('bd-nid/confirmation')
  @HttpCode(200)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Manually give NID card and dob of pilot' })
  @ApiBody({ type: BDNidDto })
  async verifyBDNid(
    @Body() bDNidDto: BDNidDto,
    @CurrentUser('userId') userId: string,
  ) {
    return await this.pilotService.processBDNid(bDNidDto, userId);
  }

  @Post('bd-rc')
  @HttpCode(200)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Upload RC card photo' })
  @UseInterceptors(
    FileFieldsInterceptor([
      { name: 'front', maxCount: 1 },
      { name: 'back', maxCount: 1 },
    ]),
  )
  async uploadBDRC(
    @UploadedFiles()
    files: { front: Express.Multer.File[]; back?: Express.Multer.File[] },
    @CurrentUser('userId') userId: string,
  ) {
    return await this.pilotService.uploadBDRC(files, userId);
  }

  @Post('bd-rc/confirmation')
  @HttpCode(200)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Manually give RC card and dob of pilot' })
  @ApiBody({ type: BDRCDto })
  async verifyBDRC(
    @Body() bDRCDto: BDRCDto,
    @CurrentUser('userId') userId: string,
  ) {
    return await this.pilotService.processBDRC(bDRCDto, userId);
  }

  @Post('number-plate')
  @HttpCode(200)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Upload Number plate photo' })
  @UseInterceptors(FileInterceptor('file'))
  async uploadNumberPlate(
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser('userId') userId: string,
  ) {
    return await this.pilotService.uploadNumberPlate(file, userId);
  }

  @Post('number-plate/confirmation')
  @HttpCode(200)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Manually give Number plate of pilot' })
  @ApiBody({ type: NumberPlateDto })
  async verifyNumberPlate(
    @Body() numberPlateDto: NumberPlateDto,
    @CurrentUser('userId') userId: string,
  ) {
    return await this.pilotService.processNumberPlate(numberPlateDto, userId);
  }
}
