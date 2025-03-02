import {
  Controller,
  Post,
  Body,
  HttpCode,
  UseGuards,
  Query,
  Req,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import {
  SendOtpDto,
  VerifyOtpDto,
  RefreshTokenDto,
  FindPilotDto,
} from './dto/auth.dto';
import { ApiTags, ApiOperation, ApiBody, ApiBearerAuth } from '@nestjs/swagger';
import { CurrentUser } from 'src/common/decorators/user.decorator';
import { QueryTokenGuard } from 'src/common/guards/query-token.guard';

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

  @Post('resend-otp')
  @HttpCode(200)
  @ApiOperation({ summary: 'Resend OTP to user' })
  @ApiBody({ type: SendOtpDto })
  async resendOtp(@Body() sendOtpDto: SendOtpDto) {
    return await this.authService.sendOtp(sendOtpDto);
  }

  @Post('refresh-token')
  @HttpCode(200)
  @ApiOperation({ summary: 'Refresh access token' })
  async refreshToken(@Body() refreshTokenDto: RefreshTokenDto) {
    return await this.authService.refreshToken(refreshTokenDto);
  }

  @Post('find-pilot')
  @ApiOperation({ summary: 'Find Pilot Account' })
  async findPilotAccount(@Body() findPilotDto: FindPilotDto) {
    return await this.authService.findMyAccount(findPilotDto);
  }

  @Post('aadhaar')
  @UseGuards(QueryTokenGuard)
  @HttpCode(200)
  async verifyAadhaar(
    @Query('token') token: string,
    @Req() req: Request,
    @CurrentUser('userId') userId: string,
  ) {
    return await this.authService.verifyAadhaar(req, userId);
  }
}
