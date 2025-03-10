import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
  HttpCode,
} from '@nestjs/common';
import { CustomerService } from './customer.service';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from 'src/common/decorators/user.decorator';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import {
  UpdateCustomerNameDto,
  UpdateSavedPlaceDto,
  CreateSavedPlaceDto,
  CompleteCustomerOnboardingDto,
} from './dto/customer.dto';
import { Roles } from 'src/common/decorators/roles.decorator';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { RoleEnum } from 'src/modules/auth/dto/auth.dto';
import { UpdatePhoneDto, VerifyPhoneDto } from 'src/common/dto/common.dto';

@ApiTags('Customer')
@Controller('customer')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(RoleEnum.CUSTOMER)
export class CustomerController {
  constructor(private readonly customerService: CustomerService) {}

  @Get()
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get customer' })
  async getCustomer(@CurrentUser('userId') userId: string) {
    return await this.customerService.getCustomer(userId);
  }

  @Post('onboarding')
  @HttpCode(200)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Complete Customer Onboarding' })
  @ApiBody({ type: CompleteCustomerOnboardingDto })
  async completeOnboarding(
    @Body() customerOnboardingDto: CompleteCustomerOnboardingDto,
    @CurrentUser('userId') userId: string,
  ) {
    return await this.customerService.completeOnboarding(
      userId,
      customerOnboardingDto,
    );
  }

  @Patch('name')
  @HttpCode(200)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update name' })
  async updateName(
    @Body() updateCustomerNameDto: UpdateCustomerNameDto,
    @CurrentUser('userId') userId: string,
  ) {
    return await this.customerService.updateName(userId, updateCustomerNameDto);
  }

  @Patch('phone/otp')
  @HttpCode(200)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update phone' })
  async updatePhone(
    @Body() updateCustomerPhoneDto: UpdatePhoneDto,
    @CurrentUser('userId') userId: string,
  ) {
    return await this.customerService.updatePhone(
      userId,
      updateCustomerPhoneDto,
    );
  }

  @Patch('phone/verify')
  @HttpCode(200)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update phone' })
  async verifyPhone(
    @Body() verifyCustomerPhoneDto: VerifyPhoneDto,
    @CurrentUser('userId') userId: string,
  ) {
    return await this.customerService.verifyPhone(
      userId,
      verifyCustomerPhoneDto,
    );
  }

  @Post('saved-places')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create saved places' })
  @ApiBody({ type: CreateSavedPlaceDto })
  async createSavedPlace(
    @Body() createSavedPlaceDto: CreateSavedPlaceDto,
    @CurrentUser('userId') userId: string,
  ) {
    return await this.customerService.createSavedPlace(
      userId,
      createSavedPlaceDto,
    );
  }

  @Get('saved-places')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get saved places' })
  async getSavedPlace(@CurrentUser('userId') userId: string) {
    return await this.customerService.getSavedPlaces(userId);
  }

  @Patch('saved-places/:id')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update saved places' })
  @ApiBody({ type: UpdateSavedPlaceDto })
  async updateSavedPlace(
    @Param('id') id: string,
    @Body() updateSavedPlaceDto: UpdateSavedPlaceDto,
    @CurrentUser('userId') userId: string,
  ) {
    return await this.customerService.updateSavedPlace(
      id,
      userId,
      updateSavedPlaceDto,
    );
  }

  @Delete('saved-places/:id')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete saved places' })
  async deleteSavedPlace(
    @Param('id') id: string,
    @CurrentUser('userId') userId: string,
  ) {
    return await this.customerService.deleteSavedPlace(id, userId);
  }

  @Get('vehicle-category')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get vehicle category' })
  async getVehicleCategory() {
    return await this.customerService.getVehicleCategories();
  }
}
