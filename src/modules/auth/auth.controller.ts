import {
  Controller,
  Post,
  Body,
  Query,
  HttpCode,
  UseGuards,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import {
  SendOtpDto,
  VerifyOtpDto,
  CompleteCustomerOnboardingDto,
  RefreshTokenDto,
} from './dto/onboarding.dto';
import { ApiTags, ApiOperation, ApiBody } from '@nestjs/swagger';
import { CurrentUser } from 'src/common/decorators/user.decorator';
import { JwtAuthGuard } from 'src/common/guards/current-user.guard';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('send-otp')
  @HttpCode(200)
  @ApiOperation({ summary: 'Send OTP to user' })
  @ApiBody({ type: SendOtpDto })
  async sendOtp(@Body() sendOtpDto: SendOtpDto) {
    return await this.authService.sendOtp(sendOtpDto);
  }

  @Post('verify-otp')
  @ApiOperation({ summary: 'Verify OTP' })
  @ApiBody({ type: VerifyOtpDto })
  async verifyOtp(@Body() verifyOtpDto: VerifyOtpDto) {
    return await this.authService.verifyOtp(verifyOtpDto);
  }

  @Post('refresh-token')
  @HttpCode(200)
  @ApiOperation({ summary: 'Refresh access token' })
  async refreshToken(@Body() refreshTokenDto: RefreshTokenDto) {
    return await this.authService.refreshToken(refreshTokenDto);
  }

  @Post('complete-onboarding')
  @HttpCode(200)
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Complete Customer Onboarding' })
  @ApiBody({ type: CompleteCustomerOnboardingDto })
  async completeOnboarding(
    @Body() customerOnboardingDto: CompleteCustomerOnboardingDto,
    @CurrentUser('userId') userId: string,
  ) {
    return await this.authService.completeOnboarding(
      userId,
      customerOnboardingDto,
    );
  }
}
