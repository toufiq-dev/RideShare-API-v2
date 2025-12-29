import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
  DefaultValuePipe,
  ParseIntPipe,
  UploadedFiles,
  UseInterceptors,
  Delete,
  ParseUUIDPipe,
  ParseEnumPipe,
} from '@nestjs/common';
import { AdminService } from '../services/admin.service';
import { ApiTags, ApiOperation, ApiBody, ApiBearerAuth } from '@nestjs/swagger';
import {
  CreateSubscriptionTypeDto,
  UpdateSubscriptionTypeDto,
  CreateSupportStuffDto,
  AppUpdateDto,
  VerifyEmailDto,
  CreateSupportRoleDto,
  LoginDto,
  CreateAdminDto,
  VerifyDriverDto,
  PromoterDetailsDto,
  DocumentType,
  ResetPasswordDto,
  SendResetPasswordOtpDto,
  EditMenuPermissionsDto,
  EditStaffDto,
  EditSupportRoleDto,
} from '../dto/admin.dto';
import { AppPlatform, UserRole, UserStatus } from '@prisma/client';
import { Roles } from 'src/common/decorators/roles.decorator';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { CurrentUser } from 'src/common/decorators/user.decorator';
import { FileFieldsInterceptor } from '@nestjs/platform-express';

@ApiTags('admin')
@Controller('admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Login as Super Admin or Admin or Support' })
  @ApiBody({
    type: LoginDto,
  })
  async login(@Body() loginDto: LoginDto) {
    return await this.adminService.login(loginDto);
  }

  @UseGuards(JwtAuthGuard)
  @Get('user-info')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get User Info' })
  async getUserInfo(@CurrentUser('userId') userId: string) {
    return await this.adminService.getUserInfo(userId);
  }

  @Post('reset-password/send-otp')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Send Reset Password OTP' })
  @ApiBody({
    type: SendResetPasswordOtpDto,
  })
  async sendResetPasswordOtp(
    @Body() sendResetPasswordOtpDto: SendResetPasswordOtpDto,
  ) {
    return await this.adminService.sendResetPasswordOtp(
      sendResetPasswordOtpDto,
    );
  }

  @Post('reset-password')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Reset Password' })
  @ApiBody({
    type: ResetPasswordDto,
  })
  async resetPassword(@Body() resetPasswordDto: ResetPasswordDto) {
    return await this.adminService.resetPassword(resetPasswordDto);
  }

  @Post('verify-email')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Verify Admin or Support' })
  @ApiBody({
    type: VerifyEmailDto,
  })
  async verifyEmail(@Body() verifyEmailDto: VerifyEmailDto) {
    return await this.adminService.verifyEmail(verifyEmailDto);
  }

  @Roles(UserRole.SUPER_ADMIN)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Post('create-admin')
  @ApiOperation({ summary: 'Create Admin' })
  @ApiBody({
    type: CreateAdminDto,
  })
  async createAdmin(@Body() createAdminDto: CreateAdminDto) {
    return await this.adminService.createAdmin(createAdminDto);
  }

  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Get('staff-list')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get all Staffs' })
  async getStaffList() {
    return await this.adminService.getStaffList();
  }

  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Delete('staff/:id')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete Staff' })
  async deleteStaff(@Param('id') id: string) {
    return await this.adminService.deleteStaff(id);
  }

  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Patch('staff/:id')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Edit Staff' })
  async editStaff(@Param('id') id: string, @Body() editStaffDto: EditStaffDto) {
    return await this.adminService.editStaff(id, editStaffDto);
  }

  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Get('menu-permissions')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get all menu permissions' })
  async getMenuPermissions(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('pageSize', new DefaultValuePipe(10), ParseIntPipe) pageSize: number,
  ) {
    return await this.adminService.getMenuPermissions(page, pageSize);
  }

  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Patch('menu-permissions/:id')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Edit menu permissions by id' })
  async editMenuPermissions(
    @Param('id') id: string,
    @Body() editMenuPermissionsDto: EditMenuPermissionsDto,
  ) {
    return await this.adminService.editMenuPermissions(
      id,
      editMenuPermissionsDto,
    );
  }

  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Delete('menu-permissions/:id')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete menu permissions by id' })
  async deleteMenuPermissions(@Param('id') id: string) {
    return await this.adminService.deleteMenuPermissions(id);
  }

  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Post('support-role')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create Support Role' })
  @ApiBody({
    type: CreateSupportRoleDto,
  })
  async createSupportRole(@Body() createSupportRoleDto: CreateSupportRoleDto) {
    return await this.adminService.createSupportRole(createSupportRoleDto);
  }

  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Get('support-roles')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get all Support Roles' })
  async getSupportRoles(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('pageSize', new DefaultValuePipe(10), ParseIntPipe) pageSize: number,
    @Query('search') search?: string,
  ) {
    return await this.adminService.getSupportRoles(page, pageSize, search);
  }

  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Patch('support-role/:id')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Edit Support Role' })
  async editSupportRole(
    @Param('id') id: string,
    @Body() editSupportRoleDto: EditSupportRoleDto,
  ) {
    return await this.adminService.editSupportRole(id, editSupportRoleDto);
  }

  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Delete('support-role/:id')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete Support Role' })
  async deleteSupportRole(@Param('id') id: string) {
    return await this.adminService.deleteSupportRole(id);
  }

  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Post('support')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create Support Member' })
  @ApiBody({
    type: CreateSupportStuffDto,
  })
  async createSupportStuff(
    @Body() createSupportStuffDto: CreateSupportStuffDto,
  ) {
    return await this.adminService.createSupportStuff(createSupportStuffDto);
  }

  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Get('support')
  @ApiOperation({ summary: 'Get all Support Members' })
  async getSupportStuffs(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('pageSize', new DefaultValuePipe(10), ParseIntPipe) pageSize: number,
  ) {
    return await this.adminService.getSupportStuffs(page, pageSize);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.SUPPORT)
  @Get('driver-list')
  @ApiOperation({ summary: 'Driver List' })
  async getDriverList(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('pageSize', new DefaultValuePipe(10), ParseIntPipe) pageSize: number,
    @Query('search') search?: string,
    @Query('status') status?: UserStatus,
    @Query('sortBy') sortBy?: string,
    @Query('sortOrder') sortOrder?: 'asc' | 'desc',
  ) {
    return await this.adminService.getDriverList(
      page,
      pageSize,
      search,
      status,
      sortBy,
      sortOrder,
    );
  }

  // @UseGuards(JwtAuthGuard, RolesGuard)
  // @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.SUPPORT)
  // @Get('driver-list-v2')
  // @ApiOperation({ summary: 'Driver List V2' })
  // async getDriverListV2(
  //   @Query() query: FilterDriverDto
  // ) {
  //   return await this.adminService.getDriverListV2(query);
  // }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.SUPPORT)
  @Get('driver/:id')
  @ApiOperation({ summary: 'Driver Details' })
  async getDriverDetails(@Param('id') id: string) {
    return await this.adminService.getDriverDetails(id);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.SUPPORT)
  @Get('driver-verification')
  @ApiOperation({ summary: 'Driver Verification' })
  async getDriverVerification(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('pageSize', new DefaultValuePipe(10), ParseIntPipe) pageSize: number,
    @Query('search') search?: string,
    @Query('sortBy') sortBy?: string,
    @Query('sortOrder') sortOrder?: 'asc' | 'desc',
  ) {
    return await this.adminService.getDriverVerification(
      page,
      pageSize,
      search,
      sortBy,
      sortOrder,
    );
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.SUPPORT)
  @Get('driver-document/:driverId')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Verify Driver' })
  @HttpCode(HttpStatus.OK)
  async getDriverDocument(
    @Param('driverId') driverId: string,
    @Query('documentType', new ParseEnumPipe(DocumentType))
    documentType: DocumentType,
  ) {
    return await this.adminService.getDriverDocument(driverId, documentType);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.SUPPORT)
  @Get('vehicle-types')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get all Vehicle Types' })
  @HttpCode(HttpStatus.OK)
  async vehicleTypes() {
    return await this.adminService.getVehicleTypes();
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.SUPPORT)
  @Patch('verify-driver/:driverId')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Verify Driver' })
  @HttpCode(HttpStatus.OK)
  async verifyDriver(
    @Param('driverId') driverId: string,
    @Query('documentType', new ParseEnumPipe(DocumentType))
    documentType: DocumentType,
    @Body() verifyDriverDto: VerifyDriverDto,
    @CurrentUser('userId') userId: string,
  ) {
    return await this.adminService.verifyDriver(
      driverId,
      documentType,
      verifyDriverDto,
      userId,
    );
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.SUPPORT)
  @Get('nid')
  @ApiOperation({ summary: 'Driver NID documents' })
  async getNid() {
    return await this.adminService.getNid();
  }

  @Get('numberplate')
  @ApiOperation({ summary: 'Driving Lincese documents' })
  async getNumberPlate() {
    return await this.adminService.getNumberPlates();
  }

  @Post('document-upload/:driverId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Upload Document of driver' })
  @UseInterceptors(
    FileFieldsInterceptor([
      { name: 'front', maxCount: 1 },
      { name: 'back', maxCount: 1 },
    ]),
  )
  async driverDocumentsUpload(
    @UploadedFiles()
    files: { front: Express.Multer.File[]; back?: Express.Multer.File[] },
    @Param('driverId', ParseUUIDPipe) driverId: string,
    @Query('documentType', new ParseEnumPipe(DocumentType))
    documentType: DocumentType,
  ) {
    return await this.adminService.driverDocumentsUpload(
      files,
      driverId,
      documentType,
    );
  }

  @Post('app-version')
  @ApiOperation({ summary: 'Update App Version' })
  @ApiBody({
    type: AppUpdateDto,
  })
  async updateAppVersion(@Body() appUpdateDto: AppUpdateDto) {
    return await this.adminService.updateAppVersion(appUpdateDto);
  }

  @Get('app-version')
  @ApiOperation({ summary: 'Get App Version' })
  async getAppVersion(@Query('platform') platform: AppPlatform) {
    return await this.adminService.getAppVersion(platform);
  }

  @Post('subscription')
  @ApiOperation({ summary: 'Create Subscription Type' })
  @ApiBody({
    type: CreateSubscriptionTypeDto,
  })
  async createSubscriptionType(
    @Body() createSubscriptionTypeDto: CreateSubscriptionTypeDto,
  ) {
    return await this.adminService.createSubscriptionType(
      createSubscriptionTypeDto,
    );
  }

  @Get('subscription')
  @ApiOperation({ summary: 'Get all Subscription Types' })
  async getSubscriptionTypes() {
    return await this.adminService.getSubscriptionTypes();
  }

  @Patch('subscription/:id')
  @ApiOperation({ summary: 'Update Subscription Type' })
  @ApiBody({
    type: CreateSubscriptionTypeDto,
  })
  async updateSubscriptionType(
    @Param('id') id: string,
    @Body() updateSubscriptionTypeDto: UpdateSubscriptionTypeDto,
  ) {
    return await this.adminService.updateSubscriptionType(
      id,
      updateSubscriptionTypeDto,
    );
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.PROMOTER)
  @Post('promoter-details')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update Promoter Details' })
  @UseInterceptors(
    FileFieldsInterceptor([
      { name: 'livePhoto', maxCount: 1 },
      { name: 'idPhoto', maxCount: 1 },
      { name: 'nidPhoto', maxCount: 1 },
    ]),
  )
  async promoterDocumentsUpload(
    @UploadedFiles()
    files: {
      livePhoto: Express.Multer.File[];
      idPhoto: Express.Multer.File[];
      nidPhoto: Express.Multer.File[];
    },
    @Body() promoterData: PromoterDetailsDto,
    @CurrentUser('userId') userId: string,
  ) {
    return this.adminService.promoterDocumentsUpload(
      files,
      promoterData,
      userId,
    );
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.PROMOTER)
  @Get('promoter-profile')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get Promoter Profile' })
  async getPromoterProfile(@CurrentUser('userId') userId: string) {
    return await this.adminService.getPromoterProfile(userId);
  }

  @Get('promoter-list')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get all Promoters' })
  async getPromoterList(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('pageSize', new DefaultValuePipe(10), ParseIntPipe) pageSize: number,
    @Query('search') search?: string,
  ) {
    return await this.adminService.getPromoterList(page, pageSize, search);
  }
}
