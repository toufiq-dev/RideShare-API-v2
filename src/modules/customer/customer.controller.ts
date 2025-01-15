import { Controller, Get, HttpCode, UseGuards } from '@nestjs/common';
import { CustomerService } from './customer.service';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from 'src/common/decorators/user.decorator';
import { JwtAuthGuard } from 'src/common/guards/current-user.guard';

@ApiTags('Customer')
@Controller('customer')
export class CustomerController {
  constructor(private readonly customerService: CustomerService) {}

  @Get()
  @HttpCode(200)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get customer' })
  async getCustomer(@CurrentUser('userId') userId: string) {
    return await this.customerService.getCustomer(userId);
  }
}
