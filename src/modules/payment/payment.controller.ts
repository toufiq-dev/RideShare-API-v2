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
import { CreateOrderDto, VerifyPaymentDto } from './dto/payment.dto';
import { UserRole } from '@prisma/client';

@ApiTags('Payment')
@Controller('payment')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.PILOT)
export class PaymentController {
  constructor(private readonly paymentService: PaymentService) {}

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
