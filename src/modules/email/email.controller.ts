import {
  Controller,
  Post,
  Body,
  HttpException,
  HttpStatus,
  HttpCode,
  UseGuards,
} from '@nestjs/common';
import { EmailService } from './email.service';
import { VerifyEmailDto } from './dto/email.dto';
import { ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { RoleEnum } from '../auth/dto/auth.dto';
import { Roles } from 'src/common/decorators/roles.decorator';
import { CurrentUser } from 'src/common/decorators/user.decorator';

@Controller('email')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(RoleEnum.CUSTOMER)
export class EmailController {
  constructor(private readonly emailService: EmailService) {}

  @Post('send-otp')
  @HttpCode(200)
  @ApiOperation({ summary: 'Send otp to verify email' })
  async sendOtp(@Body() verifyEmailDto: VerifyEmailDto) {
    return await this.emailService.sendOtpEmail(verifyEmailDto);
  }

  @Post('verify-otp')
  async verifyOtp(
    @Body() verifyEmailDto: VerifyEmailDto,
    @CurrentUser('userId') userId: string,
  ) {
    return this.emailService.verifyOtp(verifyEmailDto, userId);
  }
}
