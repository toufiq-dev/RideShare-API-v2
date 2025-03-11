import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  UseGuards,
  HttpCode,
} from '@nestjs/common';
import { PaymentService } from './payment.service';
import { CurrentUser } from 'src/common/decorators/user.decorator';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { Roles } from 'src/common/decorators/roles.decorator';
import { RoleEnum } from '../auth/dto/auth.dto';
import { CreateOrderDto } from './dto/payment.dto';

@ApiTags('Payment')
@Controller('payment')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(RoleEnum.PILOT)
export class PaymentController {
  constructor(private readonly paymentService: PaymentService) {}

  @Post('create-order')
  @HttpCode(200)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create order for buying subcsription' })
  @ApiBody({ type: CreateOrderDto })
  async createOrder(
    @Body() createOrderDto: CreateOrderDto,
    @CurrentUser('userId') userId: string,
  ) {
    return this.paymentService.createOrder(createOrderDto, userId);
  }

  @Get('verify/:orderId')
  @HttpCode(200)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Verify payment' })
  async verifyPayment(
    @Param('orderId') orderId: string,
    @CurrentUser('userId') userId: string,
  ) {
    return this.paymentService.verifyPayment(orderId, userId);
  }
}
