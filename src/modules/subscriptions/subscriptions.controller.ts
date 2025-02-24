import { Body, Controller, Get, Patch, Post, Param } from '@nestjs/common';
import { ApiBody, ApiOperation, ApiTags } from '@nestjs/swagger';
import { SubscriptionsService } from './subscriptions.service';
import {
  CreateSubscriptionTypeDto,
  UpdateSubscriptionTypeDto,
} from './dto/subscriptions.dto';
import { ApiBearerAuth } from '@nestjs/swagger';
import { CurrentUser } from 'src/common/decorators/user.decorator';

@ApiTags('Subscriptions')
@Controller('subscription')
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

  @Get('onboarding-offer')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get Faircoins for onborading' })
  async getOnboardingOffer(@CurrentUser('userId') userId: string) {
    return await this.subscriptionService.onboardingOffer(userId);
  }
}
