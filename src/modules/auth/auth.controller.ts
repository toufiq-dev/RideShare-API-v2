import {
  Controller,
  Post,
  Body,
  HttpCode,
  UseGuards,
  Get,
  HttpStatus,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import {
  SendOtpDto,
  VerifyOtpDto,
  RefreshTokenDto,
  FindPilotDto,
} from './dto/auth.dto';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiBody } from '@nestjs/swagger';
import { LocationDto } from 'src/common/dto/common.dto';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { CurrentUser } from 'src/common/decorators/user.decorator';
import { Roles } from 'src/common/decorators/roles.decorator';
import { UserRole } from '@prisma/client';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('send-otp')
  @HttpCode(HttpStatus.OK)
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

  @UseGuards(JwtAuthGuard)
  @Roles(UserRole.CUSTOMER, UserRole.PILOT)
  @Post('location')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Check location of user' })
  @HttpCode(HttpStatus.OK)
  async checkLocation(
    @Body() locationDto: LocationDto,
    @CurrentUser('userId') userId: string,
    @CurrentUser('role') role: UserRole,
  ) {
    return await this.authService.checkLocation(locationDto, userId, role);
  }

  @Post('resend-otp')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Resend OTP to user' })
  @ApiBody({ type: SendOtpDto })
  async resendOtp(@Body() sendOtpDto: SendOtpDto) {
    return await this.authService.sendOtp(sendOtpDto);
  }

  @Post('refresh-token')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Refresh access token' })
  async refreshToken(@Body() refreshTokenDto: RefreshTokenDto) {
    return await this.authService.refreshToken(refreshTokenDto);
  }

  @Post('find-pilot')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Find Pilot Account' })
  async findPilotAccount(@Body() findPilotDto: FindPilotDto) {
    return await this.authService.findMyAccount(findPilotDto);
  }

  @UseGuards(JwtAuthGuard)
  @Post('delete-account')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete Account' })
  async deleteAccount(@CurrentUser('userId') userId: string) {
    return await this.authService.deleteAccount(userId);
  }

  @UseGuards(JwtAuthGuard)
  @Roles(UserRole.CUSTOMER, UserRole.PILOT)
  @Post('logout')
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Logout' })
  async logout(@CurrentUser('userId') userId: string) {
    return await this.authService.logout(userId);
  }

  @Get('vehicle-data')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get vehicle registration points' })
  async getVehicleRegistrationPoints() {
    return await this.authService.getVehicleRegistrationPoints();
  }
}
