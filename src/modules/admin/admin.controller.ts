import { Controller, Get, Post, Body, Patch, Param } from '@nestjs/common';
import { AdminService } from './admin.service';
import { ApiTags, ApiOperation, ApiBody } from '@nestjs/swagger';
import {
  CreateSubscriptionTypeDto,
  UpdateSubscriptionTypeDto,
} from './dto/admin.dto';

@ApiTags('admin')
@Controller('admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

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
