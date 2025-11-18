import { Body, Controller, Get, Param, Post, Query } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { AdminDriverService } from "../services/admin-driver.service";
import { FilterDriverDto, RejectDocumentDto, UpdateDrivingLicenseDto, UpdateNidDto, UpdateNumberPlateDto, UpdateProfileImageDto, UpdateRegistrationCardDto, UpdateTaxTokenDto, UpdateVehicleOwnerNidDto } from "../dto/admin-driver.dto";

@ApiTags('admin-driver')
@Controller('admin/drivers')
export class AdminDriverController {
    constructor(private readonly adminDriverService: AdminDriverService) { }

    // @UseGuards(JwtAuthGuard, RolesGuard)
    // @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.SUPPORT)
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
    async updateProfileImage(@Body() updateProfileImageDto: UpdateProfileImageDto) {
        return await this.adminDriverService.updateProfileImage(updateProfileImageDto);
    }

    @Post('update-dl-info')
    @ApiOperation({ summary: 'Upload Driving License Info' })
    async updateDrivingLicense(@Body() updateDrivingLicenseDto: UpdateDrivingLicenseDto) {
        return await this.adminDriverService.updateDrivingLicense(updateDrivingLicenseDto);
    }

    @Post('update-nid-info')
    @ApiOperation({ summary: 'Upload NID Info' })
    async updateNid(@Body() updateNidDto: UpdateNidDto) {
        return await this.adminDriverService.updateNid(updateNidDto);
    }

    @Post('update-vehicle-owner-nid-info')
    @ApiOperation({ summary: 'Upload Vehicle Owner NID Info' })
    async updateVehicleOwnerNid(@Body() updateVehicleOwnerNidDto: UpdateVehicleOwnerNidDto) {
        return await this.adminDriverService.updateVehicleOwnerNid(updateVehicleOwnerNidDto);
    }

    @Post('update-registration-info')
    @ApiOperation({ summary: 'Upload Registration Info' })
    async updateRegistrationInfo(@Body() updateRegistrationCardDto: UpdateRegistrationCardDto) {
        return await this.adminDriverService.updateRegistrationInfo(updateRegistrationCardDto);
    }

    @Post('update-number-plate-info')
    @ApiOperation({ summary: 'Upload Number Plate Info' })
    async updateNumberPlateInfo(@Body() updateNumberPlateDto: UpdateNumberPlateDto) {
        return await this.adminDriverService.updateNumberPlateInfo(updateNumberPlateDto);
    }

    @Post('update-tax-token-info')
    @ApiOperation({ summary: 'Upload Tax Token Info' })
    async updateTaxTokenInfo(@Body() updateTaxTokenDto: UpdateTaxTokenDto) {
        return await this.adminDriverService.updateTaxTokenInfo(updateTaxTokenDto);
    }

    @Post('reject-document')
    @ApiOperation({ summary: 'Reject Document' })
    async rejectDocument(@Body() rejectDocumentDto: RejectDocumentDto) {
        return await this.adminDriverService.rejectDocument(rejectDocumentDto);
    }

    @Post('approve-document')
    @ApiOperation({ summary: 'Approve a specific driver document' })
    async approveDocument(@Body() approveDocumentDto: ApproveDocumentDto) {
        return await this.adminDriverService.approveDocument(approveDocumentDto);
    }


}