import { Controller, Post, Body } from '@nestjs/common';
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
  async sendOtp(@Body() sendOtpDto: SendOtpDto) {
    return await this.authService.sendOtp(sendOtpDto);
  }

  @Post('verify-otp/customer')
  async verifyOtp(@Body() verifyOtpDto: VerifyOtpDto) {
    return await this.authService.verifyOtpCustomer(verifyOtpDto);
  }

  @Post('complete-onboarding')
  async completeOnboarding(
    @Body() customerOnboardingDto: CompleteCustomerOnboardingDto,
  ) {
    return await this.authService.completeOnboarding(customerOnboardingDto);
  }
}
