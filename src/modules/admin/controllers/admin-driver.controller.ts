import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AdminDriverService } from '../services/admin-driver.service';
import {
  ApproveNidDto,
  ApproveSelfieDto,
  ApproveDrivingLicenseDto,
  ApproveVehicleOwnerNidDto,
  ApproveRegistrationCertificateDto,
  ApproveNumberPlateDto,
  ApproveTaxTokenDto,
  FilterDriverDto,
  RejectDocumentDto,
  UpdateDrivingLicenseDto,
  UpdateNidDto,
  UpdateNumberPlateDto,
  UpdateProfileImageDto,
  UpdateRegistrationCardDto,
  UpdateTaxTokenDto,
  UpdateVehicleOwnerNidDto,
} from '../dto/admin-driver.dto';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { Roles } from 'src/common/decorators/roles.decorator';
import { CurrentUser } from 'src/common/decorators/user.decorator';
import { UserRole } from 'src/modules/auth/dto/auth.dto';

const ADMIN_ROLES = [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.SUPPORT];

@ApiBearerAuth()
@ApiTags('admin-driver')
@Controller('admin/drivers')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(...ADMIN_ROLES)
export class AdminDriverController {
  constructor(private readonly adminDriverService: AdminDriverService) { }

  @Get('')
  @ApiOperation({ summary: 'Driver List' })
  async getDriverListV2(@Query() query: FilterDriverDto) {
    return await this.adminDriverService.getDriverList(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Driver Details' })
  async getDriverDetails(@Param('id') id: string) {
    return await this.adminDriverService.getDriverDetails(id);
  }

  @Post('update-selfie')
  @ApiOperation({ summary: 'Upload Driver Profile' })
  async updateProfileImage(
    @Body() updateProfileImageDto: UpdateProfileImageDto,
    @CurrentUser('userId') userId: string,
  ) {
    return await this.adminDriverService.updateProfileImage(
      updateProfileImageDto,
      userId,
    );
  }

  @Post('update-dl-info')
  @ApiOperation({ summary: 'Upload Driving License Info' })
  async updateDrivingLicense(
    @Body() updateDrivingLicenseDto: UpdateDrivingLicenseDto,
    @CurrentUser('userId') userId: string,
  ) {
    return await this.adminDriverService.updateDrivingLicense(
      updateDrivingLicenseDto,
      userId,
    );
  }

  @Post('update-nid-info')
  @ApiOperation({ summary: 'Upload NID Info' })
  async updateNid(
    @Body() updateNidDto: UpdateNidDto,
    @CurrentUser('userId') userId: string,
  ) {
    return await this.adminDriverService.updateNid(updateNidDto, userId);
  }

  @Post('update-vehicle-owner-nid-info')
  @ApiOperation({ summary: 'Upload Vehicle Owner NID Info' })
  async updateVehicleOwnerNid(
    @Body() updateVehicleOwnerNidDto: UpdateVehicleOwnerNidDto,
    @CurrentUser('userId') userId: string,
  ) {
    return await this.adminDriverService.updateVehicleOwnerNid(
      updateVehicleOwnerNidDto,
      userId,
    );
  }

  @Post('update-registration-info')
  @ApiOperation({ summary: 'Upload Registration Info' })
  async updateRegistrationInfo(
    @Body() updateRegistrationCardDto: UpdateRegistrationCardDto,
    @CurrentUser('userId') userId: string,
  ) {
    return await this.adminDriverService.updateRegistrationInfo(
      updateRegistrationCardDto,
      userId,
    );
  }

  @Post('update-number-plate-info')
  @ApiOperation({ summary: 'Upload Number Plate Info' })
  async updateNumberPlateInfo(
    @Body() updateNumberPlateDto: UpdateNumberPlateDto,
    @CurrentUser('userId') userId: string,
  ) {
    return await this.adminDriverService.updateNumberPlateInfo(
      updateNumberPlateDto,
      userId,
    );
  }

  @Post('update-tax-token-info')
  @ApiOperation({ summary: 'Upload Tax Token Info' })
  async updateTaxTokenInfo(
    @Body() updateTaxTokenDto: UpdateTaxTokenDto,
    @CurrentUser('userId') userId: string,
  ) {
    return await this.adminDriverService.updateTaxTokenInfo(
      updateTaxTokenDto,
      userId,
    );
  }

  @Post('reject-document')
  @ApiOperation({ summary: 'Reject Document' })
  async rejectDocument(
    @Body() rejectDocumentDto: RejectDocumentDto,
    @CurrentUser('userId') userId: string,
  ) {
    return await this.adminDriverService.rejectDocument(
      rejectDocumentDto,
      userId,
    );
  }


  // Approve Document APIs

  @Post('approve-selfie')
  @ApiOperation({ summary: 'Approve driver selfie' })
  async approveSelfie(
    @Body() approveSelfieDto: ApproveSelfieDto,
    @CurrentUser('userId') userId: string,
  ) {
    return await this.adminDriverService.approveSelfie(
      approveSelfieDto,
      userId,
    );
  }

  @Post('approve-driving-license')
  @ApiOperation({ summary: 'Approve driving license' })
  async approveDrivingLicense(
    @Body() approveDrivingLicenseDto: ApproveDrivingLicenseDto,
    @CurrentUser('userId') userId: string,
  ) {
    return await this.adminDriverService.approveDrivingLicense(
      approveDrivingLicenseDto,
      userId,
    );
  }

  @Post('approve-nid')
  @ApiOperation({ summary: 'Approve NID' })
  async approveNid(
    @Body() approveNidDto: ApproveNidDto,
    @CurrentUser('userId') userId: string,
  ) {
    return await this.adminDriverService.approveNid(
      approveNidDto,
      userId,
    );
  }

  @Post('approve-vehicle-owner-nid')
  @ApiOperation({ summary: 'Approve vehicle owner NID' })
  async approveVehicleOwnerNid(
    @Body() approveVehicleOwnerNidDto: ApproveVehicleOwnerNidDto,
    @CurrentUser('userId') userId: string,
  ) {
    return await this.adminDriverService.approveVehicleOwnerNid(
      approveVehicleOwnerNidDto,
      userId,
    );
  }

  @Post('approve-registration-certificate')
  @ApiOperation({ summary: 'Approve registration certificate' })
  async approveRegistrationCertificate(
    @Body() approveRegistrationCertificateDto: ApproveRegistrationCertificateDto,
    @CurrentUser('userId') userId: string,
  ) {
    return await this.adminDriverService.approveRegistrationCertificate(
      approveRegistrationCertificateDto,
      userId,
    );
  }

  @Post('approve-number-plate')
  @ApiOperation({ summary: 'Approve number plate' })
  async approveNumberPlate(
    @Body() approveNumberPlateDto: ApproveNumberPlateDto,
    @CurrentUser('userId') userId: string,
  ) {
    return await this.adminDriverService.approveNumberPlate(
      approveNumberPlateDto,
      userId,
    );
  }

  @Post('approve-tax-token')
  @ApiOperation({ summary: 'Approve tax token' })
  async approveTaxToken(
    @Body() approveTaxTokenDto: ApproveTaxTokenDto,
    @CurrentUser('userId') userId: string,
  ) {
    return await this.adminDriverService.approveTaxToken(
      approveTaxTokenDto,
      userId,
    );
  }
}
