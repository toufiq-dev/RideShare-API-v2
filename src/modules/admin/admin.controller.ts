import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AdminService } from './admin.service';
import { ApiTags, ApiOperation, ApiBody, ApiBearerAuth } from '@nestjs/swagger';
import {
  CreateSubscriptionTypeDto,
  UpdateSubscriptionTypeDto,
  CreateSupportStuffDto,
  AppUpdateDto,
  AdminLoginDto,
} from './dto/admin.dto';
import { AppPlatform } from '@prisma/client';
import { Roles } from 'src/common/decorators/roles.decorator';
import { RoleEnum } from '../auth/dto/auth.dto';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { RolesGuard } from 'src/common/guards/roles.guard';

@ApiTags('admin')
@Controller('admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

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

  @Post('login')
  @ApiOperation({ summary: 'Admin Login' })
  async adminLogin(@Body() adminLoginDto: AdminLoginDto) {
    return await this.adminService.adminLogin(adminLoginDto);
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
  @Roles(RoleEnum.ADMIN)
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

  @Get('support')
  @ApiOperation({ summary: 'Get all Support Members' })
  async getSupportStuffs() {
    return await this.adminService.getSupportStuffs();
  }

  // @UseGuards(JwtAuthGuard, RolesGuard)
  // @Roles(RoleEnum.SUPPORT)
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
}
