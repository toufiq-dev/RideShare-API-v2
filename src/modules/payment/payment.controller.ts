import {
  Controller,
  Post,
  Body,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { PaymentService } from './payment.service';
import { CurrentUser } from 'src/common/decorators/user.decorator';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { Roles } from 'src/common/decorators/roles.decorator';
import {
  CreateOrderDto,
  VerifyPaymentDto,
  VerifySslcommerzDto,
} from './dto/payment.dto';
import { UserRole } from '@prisma/client';

@ApiTags('Payment')
@Controller('payment')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.PILOT)
export class PaymentController {
  constructor(private readonly paymentService: PaymentService) {}

  @Post('sslcommerz/init')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Init SSLCommerz payment for subscription purchase',
  })
  @ApiBody({ type: CreateOrderDto })
  initSslcommerz(
    @Body() dto: CreateOrderDto,
    @CurrentUser('userId') userId: string,
  ) {
    return this.paymentService.initSslcommerzSubscription(dto, userId);
  }

  @Post('sslcommerz/verify/:tranId')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Verify SSLCommerz payment (server-to-server validation)',
  })
  verifySslcommerz(
    @Param('transactionId') transactionId: string,
    @Body() dto: VerifySslcommerzDto,
    @CurrentUser('userId') userId: string,
  ) {
    return this.paymentService.verifySslcommerzSubscription(
      transactionId,
      userId,
    );
  }

  @Post('create-order')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create order for buying subcsription' })
  @ApiBody({ type: CreateOrderDto })
  async createOrder(
    @Body() createOrderDto: CreateOrderDto,
    @CurrentUser('userId') userId: string,
  ) {
    return this.paymentService.createOrder(createOrderDto, userId);
  }

  @Post('verify/:orderId')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Verify payment' })
  async verifyPayment(
    @Param('orderId') orderId: string,
    @Body() verifyPaymentDto: VerifyPaymentDto,
    @CurrentUser('userId') userId: string,
  ) {
    return this.paymentService.verifyPayment(orderId, verifyPaymentDto, userId);
  }
}
