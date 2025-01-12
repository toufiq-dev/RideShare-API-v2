import { Controller, Post, Body, Query, HttpCode } from '@nestjs/common';
import { AuthService } from './auth.service';
import {
  SendOtpDto,
  VerifyOtpDto,
  CompleteCustomerOnboardingDto,
} from './dto/onboarding.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('send-otp')
  @HttpCode(200)
  async sendOtp(@Body() sendOtpDto: SendOtpDto) {
    return await this.authService.sendOtp(sendOtpDto);
  }

  @Post('verify-otp')
  async verifyOtp(
    @Body() verifyOtpDto: VerifyOtpDto,
  ) {
    return await this.authService.verifyOtp(verifyOtpDto);
  }

  @Post('refresh-token')
  @HttpCode(200)
  async refreshToken(
    @Body('userId') userId: string,
    @Body('refreshToken') token: string,
  ) {
    return await this.authService.refreshToken(userId, token);
  }

  @Post('complete-onboarding')
  @HttpCode(200)
  async completeOnboarding(
    @Body() customerOnboardingDto: CompleteCustomerOnboardingDto,
  ) {
    return await this.authService.completeOnboarding(customerOnboardingDto);
  }
}
