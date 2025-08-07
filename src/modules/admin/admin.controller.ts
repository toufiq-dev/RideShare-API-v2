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
} from '@nestjs/common';
import { AdminService } from './admin.service';
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
} from './dto/admin.dto';
import {
  AppPlatform,
  UserRole,
  UserStatus,
  VerificationStatus,
} from '@prisma/client';
import { Roles } from 'src/common/decorators/roles.decorator';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { CurrentUser } from 'src/common/decorators/user.decorator';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { IsOptional } from 'class-validator';

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
  ) {
    return await this.adminService.getSupportRoles(page, pageSize);
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
  @Get('verify-driver')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Verify Driver' })
  @HttpCode(HttpStatus.OK)
  async verifyDriver(
    @Body() verifyDriverDto: VerifyDriverDto,
    @CurrentUser('userId') userId: string,
  ) {
    return await this.adminService.verifyDriver(userId, verifyDriverDto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.SUPPORT)
  @Get('nid')
  @ApiOperation({ summary: 'NID documents' })
  async getNid() {
    return await this.adminService.getNid();
  }

  @Get('numberplate')
  @ApiOperation({ summary: 'Driving Lincese documents' })
  async getNumberPlate() {
    return await this.adminService.getNumberPlates();
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
  async uploadDocuments(
    @UploadedFiles()
    files: {
      livePhoto: Express.Multer.File[];
      idPhoto: Express.Multer.File[];
      nidPhoto: Express.Multer.File[];
    },
    @Body() promoterData: PromoterDetailsDto,
    @CurrentUser('userId') userId: string,
  ) {
    return this.adminService.uploadDocuments(files, promoterData, userId);
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
