import { Body, Controller, Get, Patch, Post, Param, UseGuards } from '@nestjs/common';
import { ApiBody, ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { Roles } from 'src/common/decorators/roles.decorator';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { SubscriptionsService } from './subscriptions.service';
import {
  CreateSubscriptionTypeDto,
  UpdateSubscriptionTypeDto,
} from './dto/subscriptions.dto';

@ApiTags('Subscriptions')
@Controller('subscription')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
@ApiBearerAuth()
export class SubscriptionsController {
  constructor(private readonly subscriptionService: SubscriptionsService) {}

  @Get('types')
  @ApiOperation({ summary: 'Get all Subscription Types' })
  async getSubscriptionTypes() {
    return await this.subscriptionService.getSubscriptionTypes();
  }

  @Post('types')
  @ApiOperation({ summary: 'Create Subscription Type' })
  @ApiBody({
    type: CreateSubscriptionTypeDto,
  })
  async createSubscriptionType(
    @Body() createSubscriptionTypeDto: CreateSubscriptionTypeDto,
  ) {
    return await this.subscriptionService.createSubscriptionType(
      createSubscriptionTypeDto,
    );
  }

  @Patch('types/:id')
  @ApiOperation({ summary: 'Update Subscription Type' })
  @ApiBody({
    type: CreateSubscriptionTypeDto,
  })
  async updateSubscriptionType(
    @Param('id') id: string,
    @Body() updateSubscriptionTypeDto: UpdateSubscriptionTypeDto,
  ) {
    return await this.subscriptionService.updateSubscriptionType(
      id,
      updateSubscriptionTypeDto,
    );
  }
}
