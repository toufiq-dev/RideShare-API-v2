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
  HttpStatus,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PilotService } from './pilot.service';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { CurrentUser } from 'src/common/decorators/user.decorator';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiQuery,
} from '@nestjs/swagger';
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
  BDNidTypeDto,
  UpdateDriverDetailsDto,
  PilotIdQueryDto,
  BDNidType,
} from './dto/pilot.dto';
import { Roles } from 'src/common/decorators/roles.decorator';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { VerifyPhoneDto } from 'src/common/dto/common.dto';
import { UserRole } from '@prisma/client';

@Controller('pilot')
@UseGuards(JwtAuthGuard, RolesGuard)
export class PilotController {
  constructor(private readonly pilotService: PilotService) {}

  @Get()
  @Roles(UserRole.PILOT)
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get pilot' })
  async getPilot(@CurrentUser('userId') userId: string) {
    return await this.pilotService.getPilot(userId);
  }

  @Post('phone/otp')
  @Roles(UserRole.PILOT)
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Send otp to Update phone' })
  async updatePhone(@CurrentUser('userId') userId: string) {
    return await this.pilotService.updatePhone(userId);
  }

  @Post('phone/verify')
  @Roles(UserRole.PILOT)
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update phone' })
  async verifyPhone(
    @Body() verifyCustomerPhoneDto: VerifyPhoneDto,
    @CurrentUser('userId') userId: string,
  ) {
    return await this.pilotService.verifyPhone(userId, verifyCustomerPhoneDto);
  }

  @Post('driving-license')
  @Roles(UserRole.PILOT, UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.SUPPORT)
  @HttpCode(HttpStatus.OK)
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
  @Roles(UserRole.PILOT)
  @HttpCode(HttpStatus.OK)
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
  @Roles(UserRole.PILOT, UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.SUPPORT)
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Upload live selfie for pilot verification',
    description:
      'Uploads a live selfie photo of the pilot for identity verification.',
  })
  @ApiConsumes('multipart/form-data')
  @ApiQuery({
    name: 'pilotId',
    required: false,
    description:
      'Pilot user ID (required for ADMIN/SUPER_ADMIN/SUPPORT roles, must not be provided for PILOT role). When provided by admin roles, this specifies which pilot the selfie belongs to.',
    type: String,
  })
  @UseInterceptors(CustomFileInterceptor)
  async uploadLiveSelfie(
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser('userId') userId: string,
    @CurrentUser('role') role: UserRole,
    @Query('pilotId') pilotId?: string,
  ) {
    let targetUserId: string;

    if (role === UserRole.PILOT) {
      if (pilotId) {
        throw new ForbiddenException(
          'Pilots cannot specify pilotId parameter.',
        );
      }
      targetUserId = userId;
    } else {
      if (!pilotId) {
        throw new BadRequestException(
          'pilotId query parameter is required for admin roles.',
        );
      }
      targetUserId = pilotId;
    }
    return await this.pilotService.uploadLiveSelfie(file, targetUserId, role);
  }

  @Post('vehicle-rc')
  @Roles(UserRole.PILOT, UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.SUPPORT)
  @HttpCode(HttpStatus.OK)
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
  @Roles(UserRole.PILOT)
  @HttpCode(HttpStatus.OK)
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
  @HttpCode(HttpStatus.OK)
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
  @HttpCode(HttpStatus.OK)
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
  @HttpCode(HttpStatus.OK)
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
  @HttpCode(HttpStatus.OK)
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
  @HttpCode(HttpStatus.OK)
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
  @Roles(UserRole.PILOT)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get Faircoins for onborading' })
  async getOnboardingOffer(@CurrentUser('userId') userId: string) {
    return await this.pilotService.onboardingOffer(userId);
  }

  @Post('free-recharge')
  @Roles(UserRole.PILOT)
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
  @Roles(UserRole.PILOT)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get list of vehicles' })
  async getVehicles(@CurrentUser('userId') userId: string) {
    return await this.pilotService.getVehicles(userId);
  }

  @Get('transactions')
  @Roles(UserRole.PILOT)
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
  @Roles(UserRole.PILOT)
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Make Pilot available for trips' })
  async beOnline(
    @Body() beOnlineDto: BeOnlineDto,
    @CurrentUser('userId') userId: string,
  ) {
    return await this.pilotService.beOnline(userId, beOnlineDto);
  }

  @Post('bd-license')
  @Roles(UserRole.PILOT, UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.SUPPORT)
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Upload Bangladesh driving license documents',
    description:
      'Uploads front and back photos of a Bangladesh driving license for pilot verification. The front photo is required, while the back photo is optional. For pilots, the license is automatically associated with their account. For admin/support roles, a pilotId query parameter must be provided.',
  })
  @ApiConsumes('multipart/form-data')
  @ApiQuery({
    name: 'pilotId',
    required: false,
    description:
      'Pilot user ID (required for ADMIN/SUPER_ADMIN/SUPPORT roles, must not be provided for PILOT role). When provided by admin roles, this specifies which pilot the license belongs to.',
    type: String,
  })
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
    @Query() query: PilotIdQueryDto,
    @CurrentUser('userId') userId: string,
    @CurrentUser('role') role: UserRole,
  ) {
    let targetUserId: string;

    if (role === UserRole.PILOT) {
      if (query.pilotId) {
        throw new ForbiddenException(
          'Pilots cannot specify pilotId parameter.',
        );
      }
      targetUserId = userId;
    } else {
      if (!query.pilotId) {
        throw new BadRequestException(
          'pilotId query parameter is required for admin roles.',
        );
      }
      targetUserId = query.pilotId;
    }

    return await this.pilotService.uploadBDLicense(files, targetUserId, role);
  }

  @Post('bd-license/confirmation')
  @Roles(UserRole.PILOT)
  @HttpCode(HttpStatus.OK)
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
  @Roles(UserRole.PILOT, UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.SUPPORT)
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Upload Bangladesh National ID (NID) card documents',
    description:
      'Uploads front and back photos of a Bangladesh National ID (NID) card for pilot or vehicle owner verification. The type parameter specifies whether the NID belongs to the pilot or the vehicle owner. Both front and back photos are required. For pilots, the NID is automatically associated with their account. For admin/support roles, a pilotId query parameter must be provided.',
  })
  @ApiConsumes('multipart/form-data')
  @ApiQuery({
    name: 'type',
    required: true,
    description:
      'Type of NID - either "pilot" for pilot\'s NID or "vehicleOwner" for vehicle owner\'s NID',
    enum: Object.values(BDNidType),
  })
  @ApiQuery({
    name: 'pilotId',
    required: false,
    description:
      'Pilot user ID (required for ADMIN/SUPER_ADMIN/SUPPORT roles, must not be provided for PILOT role). When provided by admin roles, this specifies which pilot the NID belongs to.',
    type: String,
  })
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
    @Query('type') type: BDNidType,
    @CurrentUser('userId') userId: string,
    @CurrentUser('role') role: UserRole,
    @Query('pilotId') pilotId?: string,
  ) {
    let targetUserId: string;

    if (role === UserRole.PILOT) {
      if (pilotId) {
        throw new ForbiddenException(
          'Pilots cannot specify pilotId parameter.',
        );
      }
      targetUserId = userId;
    } else {
      if (!pilotId) {
        throw new BadRequestException(
          'pilotId query parameter is required for admin roles.',
        );
      }
      targetUserId = pilotId;
    }

    return await this.pilotService.uploadBDNid(files, targetUserId, role, type);
  }

  @Post('bd-nid/confirmation')
  @Roles(UserRole.PILOT)
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Manually give NID card and dob of pilot' })
  @ApiBody({ type: BDNidDto })
  async verifyBDNid(
    @Body() bDNidDto: BDNidDto,
    @Query() query: BDNidTypeDto,
    @CurrentUser('userId') userId: string,
  ) {
    return await this.pilotService.processBDNid(bDNidDto, userId, query.type);
  }

  @Post('bd-rc')
  @Roles(UserRole.PILOT, UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.SUPPORT)
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({
    summary:
      'Upload Bangladesh Vehicle Registration Certificate (RC) documents',
    description:
      'Uploads front and back photos of a Bangladesh Vehicle Registration Certificate (RC) for vehicle verification. The front photo is required, while the back photo is optional. For admin/support roles, a pilotId query parameter must be provided.',
  })
  @ApiConsumes('multipart/form-data')
  @ApiQuery({
    name: 'pilotId',
    required: false,
    description:
      'Pilot user ID (required for ADMIN/SUPER_ADMIN/SUPPORT roles, must not be provided for PILOT role). When provided by admin roles, this specifies which pilot the RC belongs to.',
    type: String,
  })
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
    @Query() query: PilotIdQueryDto,
    @CurrentUser('userId') userId: string,
    @CurrentUser('role') role: UserRole,
  ) {
    let targetUserId: string;

    if (role === UserRole.PILOT) {
      if (query.pilotId) {
        throw new ForbiddenException(
          'Pilots cannot specify pilotId parameter.',
        );
      }
      targetUserId = userId;
    } else {
      if (!query.pilotId) {
        throw new BadRequestException(
          'pilotId query parameter is required for admin roles.',
        );
      }
      targetUserId = query.pilotId;
    }

    return await this.pilotService.uploadBDRC(files, targetUserId, role);
  }

  @Post('bd-rc/confirmation')
  @Roles(UserRole.PILOT)
  @HttpCode(HttpStatus.OK)
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
  @Roles(UserRole.PILOT, UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.SUPPORT)
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Upload vehicle number plate photo',
    description:
      "Uploads a photo of the vehicle's number plate for verification. The number plate photo is used to verify the vehicle registration and ensure it matches the submitted RC documents. After uploading, pilots must confirm the number plate details using the /number-plate/confirmation endpoint. For pilots, the number plate is automatically associated with their account. For admin/support roles, a pilotId query parameter must be provided.",
  })
  @ApiConsumes('multipart/form-data')
  @ApiQuery({
    name: 'pilotId',
    required: false,
    description:
      'Pilot user ID (required for ADMIN/SUPER_ADMIN/SUPPORT roles, must not be provided for PILOT role). When provided by admin roles, this specifies which pilot the number plate belongs to.',
    type: String,
  })
  @ApiOperation({ summary: 'Upload Number plate photo' })
  @UseInterceptors(FileInterceptor('file'))
  async uploadNumberPlate(
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser('userId') userId: string,
    @CurrentUser('role') role: UserRole,
    @Query() query: PilotIdQueryDto,
  ) {
    let targetUserId: string;

    if (role === UserRole.PILOT) {
      if (query.pilotId) {
        throw new ForbiddenException(
          'Pilots cannot specify pilotId parameter.',
        );
      }
      targetUserId = userId;
    } else {
      if (!query.pilotId) {
        throw new BadRequestException(
          'pilotId query parameter is required for admin roles.',
        );
      }
      targetUserId = query.pilotId;
    }
    return await this.pilotService.uploadNumberPlate(file, targetUserId, role);
  }

  @Post('number-plate/confirmation')
  @Roles(UserRole.PILOT)
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Manually give Number plate of pilot' })
  @ApiBody({ type: NumberPlateDto })
  async verifyNumberPlate(
    @Body() numberPlateDto: NumberPlateDto,
    @CurrentUser('userId') userId: string,
  ) {
    return await this.pilotService.processNumberPlate(numberPlateDto, userId);
  }

  @Post('tax-token')
  @Roles(UserRole.PILOT, UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.SUPPORT)
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Upload vehicle tax token document',
    description:
      "Uploads a photo of the vehicle's tax token document for verification. For pilots, the tax token is automatically associated with their account. For admin/support roles, a pilotId query parameter must be provided.",
  })
  @ApiConsumes('multipart/form-data')
  @ApiQuery({
    name: 'pilotId',
    required: false,
    description:
      'Pilot user ID (required for ADMIN/SUPER_ADMIN/SUPPORT roles, must not be provided for PILOT role). When provided by admin roles, this specifies which pilot the tax token belongs to.',
    type: String,
  })
  @ApiOperation({ summary: 'Upload Tax token photo' })
  @UseInterceptors(FileInterceptor('file'))
  async uploadTaxToken(
    @UploadedFile() file: Express.Multer.File,
    @Query() query: PilotIdQueryDto,
    @CurrentUser('userId') userId: string,
    @CurrentUser('role') role: UserRole,
  ) {
    let targetUserId: string;

    if (role === UserRole.PILOT) {
      if (query.pilotId) {
        throw new ForbiddenException(
          'Pilots cannot specify pilotId parameter.',
        );
      }
      targetUserId = userId;
    } else {
      if (!query.pilotId) {
        throw new BadRequestException(
          'pilotId query parameter is required for admin roles.',
        );
      }
      targetUserId = query.pilotId;
    }

    return await this.pilotService.uploadTaxToken(file, targetUserId, role);
  }

  @Post('details')
  @Roles(UserRole.PILOT)
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update Driver details' })
  @ApiBody({ type: UpdateDriverDetailsDto })
  async updateDriverDetails(
    @Body() updateDriverDetailsDto: UpdateDriverDetailsDto,
    @CurrentUser('userId') userId: string,
  ) {
    return await this.pilotService.updateDriverDetails(
      updateDriverDetailsDto,
      userId,
    );
  }

  @Get('coupons')
  @Roles(UserRole.PILOT)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get list of coupons' })
  async getCoupons(@CurrentUser('userId') userId: string) {
    return await this.pilotService.getCoupons(userId);
  }
}
