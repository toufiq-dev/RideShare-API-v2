import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Query,
} from '@nestjs/common';
import { AdminService } from './admin.service';
import { ApiTags, ApiOperation, ApiBody } from '@nestjs/swagger';
import {
  CreateSubscriptionTypeDto,
  UpdateSubscriptionTypeDto,
  CreateSupportStuffDto,
  AppUpdateDto,
} from './dto/admin.dto';
import { AppPlatform } from '@prisma/client';

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

  @Post('support')
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
}
