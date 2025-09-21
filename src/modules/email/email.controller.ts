import {
  Controller,
  Post,
  Body,
  HttpCode,
  UseGuards,
  HttpStatus,
} from '@nestjs/common';
import { EmailService } from './email.service';
import { EmailSendOtpDto, EmailVerifyEmailDto } from './dto/email.dto';
import { ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { Roles } from 'src/common/decorators/roles.decorator';
import { CurrentUser } from 'src/common/decorators/user.decorator';
import { UserRole } from '@prisma/client';

@Controller('email')
export class EmailController {
  constructor(private readonly emailService: EmailService) {}

  @Post('send-otp')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Send otp to verify email' })
  async sendOtp(@Body() sendOtpDto: EmailSendOtpDto) {
    return await this.emailService.sendOtpEmail(sendOtpDto);
  }

  @Roles(UserRole.CUSTOMER)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Post('verify-email')
  @HttpCode(HttpStatus.OK)
  async verifyOtp(
    @Body() verifyEmailDto: EmailVerifyEmailDto,
    @CurrentUser('userId') userId: string,
  ) {
    return this.emailService.verifyOtpCustomer(verifyEmailDto, userId);
  }
}
