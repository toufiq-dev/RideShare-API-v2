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
} from '@nestjs/common';
import { AdminService } from './admin.service';
import { ApiTags, ApiOperation, ApiBody, ApiBearerAuth } from '@nestjs/swagger';
import {
  CreateSubscriptionTypeDto,
  UpdateSubscriptionTypeDto,
  CreateSupportStuffDto,
  AppUpdateDto,
  SuperAdminLoginDto,
  CreateAdminDto,
  AdminLoginDto,
  VerifyEmailDto,
  CreateSupportRoleDto,
} from './dto/admin.dto';
import { AppPlatform, UserRole } from '@prisma/client';
import { Roles } from 'src/common/decorators/roles.decorator';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { RolesGuard } from 'src/common/guards/roles.guard';

@ApiTags('admin')
@Controller('admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Post('super/login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Super Admin Login' })
  async superAdminLogin(@Body() superAdminLoginDto: SuperAdminLoginDto) {
    return await this.adminService.superAdminLogin(superAdminLoginDto);
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

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Admin Login' })
  @ApiBody({
    type: AdminLoginDto,
  })
  async adminLogin(@Body() adminLoginDto: AdminLoginDto) {
    return await this.adminService.adminLogin(adminLoginDto);
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

  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Get('support-roles')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get all Support Roles' })
  async getSupportRoles() {
    return await this.adminService.getSupportRoles();
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
  async getSupportStuffs() {
    return await this.adminService.getSupportStuffs();
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPPORT)
  @Get('driving-license')
  @ApiOperation({ summary: 'Driving Lincese documents' })
  async getDrivingLicense() {
    return await this.adminService.getDrivingLicense();
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
}
