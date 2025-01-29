import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { CustomerService } from './customer.service';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from 'src/common/decorators/user.decorator';
import { JwtAuthGuard } from 'src/common/guards/current-user.guard';
import { UpdateSavedPlaceDto, CreateSavedPlaceDto } from './dto/customer.dto';

@ApiTags('Customer')
@Controller('customer')
export class CustomerController {
  constructor(private readonly customerService: CustomerService) {}

  @Get()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get customer' })
  async getCustomer(@CurrentUser('userId') userId: string) {
    return await this.customerService.getCustomer(userId);
  }

  @Post('saved-places')
  @UseGuards(JwtAuthGuard)
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
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get saved places' })
  async getSavedPlace(@CurrentUser('userId') userId: string) {
    return await this.customerService.getSavedPlaces(userId);
  }

  @Patch('saved-places/:id')
  @UseGuards(JwtAuthGuard)
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
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete saved places' })
  async deleteSavedPlace(
    @Param('id') id: string,
    @CurrentUser('userId') userId: string,
  ) {
    return await this.customerService.deleteSavedPlace(id, userId);
  }
}
