import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
  Query,
} from '@nestjs/common';
import { PaymentService } from './payment.service';
import { CurrentUser } from 'src/common/decorators/user.decorator';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { Roles } from 'src/common/decorators/roles.decorator';
import {
  CreateOrderDto,
  VerifyPaymentDto,
  SslcommerzCallbackQueryDto,
  ReconcileSslcommerzDto,
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

  @Get('sslcommerz/success')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({
    summary:
      'SSLCommerz success callback - Verifies payment via server-to-server validation',
    description:
      'Called by Android app after successful payment. Validates with SSLCommerz APIs and credits wallet.',
  })
  @ApiQuery({
    name: 'transactionId',
    description: 'SSLCommerz transaction ID (tran_id)',
    example: 'FDa65f8d1f90194',
    required: true,
  })
  verifySslcommerzSuccess(
    @Query() query: SslcommerzCallbackQueryDto,
    @CurrentUser('userId') userId: string,
  ) {
    return this.paymentService.verifySslcommerzSuccess(
      query.transactionId,
      userId,
    );
  }

  @Get('sslcommerz/fail')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'SSLCommerz failure callback - Marks transaction as failed',
    description:
      'Called by Android app when payment fails. Updates transaction status to FAILED.',
  })
  @ApiQuery({
    name: 'transactionId',
    description: 'SSLCommerz transaction ID (tran_id)',
    example: 'FDa65f8d1f90194',
    required: true,
  })
  markSslcommerzFailed(
    @Query() query: SslcommerzCallbackQueryDto,
    @CurrentUser('userId') userId: string,
  ) {
    return this.paymentService.markSslcommerzFailed(
      query.transactionId,
      userId,
    );
  }

  @Post('sslcommerz/verify')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({
    summary:
      'Manual reconciliation for SSLCommerz payment - Handles network disruptions',
    description:
      'Called by Android app when network disruption occurs but payment may have succeeded. Verifies with SSLCommerz if success=true, otherwise marks as failed.',
  })
  @ApiBody({ type: ReconcileSslcommerzDto })
  reconcileSslcommerz(
    @Body() dto: ReconcileSslcommerzDto,
    @CurrentUser('userId') userId: string,
  ) {
    return this.paymentService.verifySslcommerzPayment(dto, userId);
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
