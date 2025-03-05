import { randomInt } from 'node:crypto';
import {
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from 'src/core/database/prisma.service';
import { RedisService } from 'src/core/cache/redis.service';
import { OTPService } from 'src/core/utils/otp.util';
import { JwtService } from '@nestjs/jwt';
import {
  SendOtpDto,
  VerifyOtpDto,
  RefreshTokenDto,
  RoleEnum,
  FindPilotDto,
} from './dto/auth.dto';
import { RideGateway } from '../ride/ride.gateway';

@Injectable()
export class AuthService {
  private readonly accessTokenExpiresIn: string;
  private readonly refreshTokenExpiresIn: string;
  private readonly jwtSecret: string;
  private readonly redisAccessTokenTTL: number;
  private readonly redisRefreshTokenTTL: number;
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly otpService: OTPService,
    private readonly rideGateway: RideGateway,
  ) {
    this.accessTokenExpiresIn = this.configService.get<string>(
      'jwt.accessTokenExpiresIn',
    );
    this.refreshTokenExpiresIn = this.configService.get<string>(
      'jwt.refreshTokenExpiresIn',
    );
    this.jwtSecret = this.configService.get<string>('jwt.secret');
    this.redisAccessTokenTTL = this.configService.get<number>(
      'redis.accessTokenTTL',
    );
    this.redisRefreshTokenTTL = this.configService.get<number>(
      'redis.refreshTokenTTL',
    );
  }

  async sendOtp(sendOtpDto: SendOtpDto) {
    const { language, phone, referralCode } = sendOtpDto;

    try {
      const Language = await this.prisma.languages.findUnique({
        where: { name: language },
      });
      if (!Language) {
        throw new NotFoundException('Language not found.');
      }

      const otp = randomInt(1000, 10000).toString();
      await this.redis.set(`otp:${phone}`, otp, 300);
      await this.redis.set(`languageId:${phone}`, Language.id, 300);
      await this.redis.set(`referralCode:${phone}`, referralCode, 300);

      // const requestId = await this.msg91.sendOTP(phone);

      // await this.redis.set(`requestId:${phone}`, requestId, 300);

      return {
        message: 'OTP sent to your phone successfully.',
        data: {
          otp,
        },
      };
    } catch (error) {
      console.error(error);
      throw error;
    }
  }

  async verifyOtp(verifyOtpDto: VerifyOtpDto) {
    const { phone, otp, role } = verifyOtpDto;

    try {
      const { languageId, refferalCode } = await this.validateOtpRedis(
        phone,
        otp,
      );

      // const languageId = await this.validateOtp(phone, otp);

      const { user, customer, pilot, isNewUser } = await this.findOrCreateUser(
        phone,
        role,
        languageId,
        refferalCode,
      );

      const tokens = await this.generateTokens(user.id, user.role);

      return {
        message: 'OTP verified successfully.',
        data: {
          ...tokens,
          isAlreadyRegistered: !isNewUser,
          user: role === RoleEnum.CUSTOMER ? customer : pilot,
        },
      };
    } catch (error) {
      console.error(error);
      throw error;
    }
  }

  async refreshToken(refreshTokenDto: RefreshTokenDto) {
    const { refreshToken } = refreshTokenDto;

    try {
      const { userId, role } = await this.jwtService.verifyAsync(refreshToken, {
        secret: this.jwtSecret,
      });

      const storedToken = await this.redis.get(`refreshToken:${userId}`);
      if (!storedToken || storedToken !== refreshToken) {
        throw new UnauthorizedException('Invalid or expired refresh token.');
      }

      await this.redis.del(`refreshToken:${userId}`);

      const data = await this.generateTokens(userId, role);

      return {
        message: 'Refresh token generated successfully.',
        data,
      };
    } catch (error) {
      console.error(error);
      throw error;
    }
  }

  async findMyAccount(findPilotDto: FindPilotDto) {
    const { phone } = findPilotDto;
    try {
      const data = await this.prisma.pilot.findUnique({
        where: { phone },
        include: {
          drivingLicense: true,
        },
      });

      if (!data) {
        throw new NotFoundException('Pilot not found.');
      }

      return {
        message: 'Pilot found successfully.',
        data,
      };
    } catch (error) {
      console.error(error);
      throw error;
    }
  }

  private async validateOtpRedis(phone: string, otp: string) {
    const storedOtp = await this.redis.get(`otp:${phone}`);

    if (!storedOtp || storedOtp !== otp) {
      throw new UnauthorizedException('Invalid or expired OTP.');
    }

    const languageId = await this.redis.get(`languageId:${phone}`);
    const refferalCode = await this.redis.get(`referralCode:${phone}`);

    await this.redis.del(`otp:${phone}`);
    await this.redis.del(`languageId:${phone}`);
    await this.redis.del(`referralCode:${phone}`);

    return { languageId, refferalCode };
  }

  private async validateOtp(phone: string, otp: string) {
    const request_id = await this.redis.get(`requestId:${phone}`);

    const isVerified = await this.otpService.verifyOTP(phone, otp, request_id);
    if (!isVerified) {
      throw new UnauthorizedException('Invalid or expired OTP.');
    }

    const languageId = await this.redis.get(`languageId:${phone}`);
    const refferalCode = await this.redis.get(`referralCode:${phone}`);

    await this.redis.del(`languageId:${phone}`);
    await this.redis.del(`referralCode:${phone}`);

    return { languageId, refferalCode };
  }

  private async findOrCreateUser(
    phone: string,
    role: RoleEnum,
    languageId: string,
    referralCode: string,
  ) {
    let customer = null;
    let pilot = null;
    let user = null;
    let isNewUser = false;

    if (role === RoleEnum.CUSTOMER) {
      customer = await this.prisma.customer.findUnique({
        where: { phone },
      });

      if (customer) {
        user = await this.prisma.user.findUnique({
          where: { id: customer.userId },
        });
      }
    } else if (role === RoleEnum.PILOT) {
      pilot = await this.prisma.pilot.findUnique({ where: { phone } });

      if (pilot) {
        user = await this.prisma.user.findUnique({
          where: { id: pilot.userId },
        });
      }
    }

    if (!user) {
      user = await this.prisma.user.create({
        data: {
          role,
          isPhoneVerified: true,
        },
      });

      if (role === RoleEnum.CUSTOMER && !customer) {
        customer = await this.prisma.customer.create({
          data: {
            phone,
            userId: user.id,
            languageId,
          },
        });
      } else if (role === RoleEnum.PILOT && !pilot) {
        pilot = await this.prisma.pilot.create({
          data: {
            phone,
            userId: user.id,
            languageId,
            referralCode,
          },
        });
      }

      isNewUser = true;
    }

    return { user, customer, pilot, isNewUser };
  }

  private async generateTokens(userId: string, role: RoleEnum) {
    await this.redis.del(`accessToken:${userId}`);
    await this.redis.del(`refreshToken:${userId}`);

    const accessToken = await this.jwtService.signAsync(
      { userId, role },
      { expiresIn: this.accessTokenExpiresIn },
    );

    const refreshToken = await this.jwtService.signAsync(
      { userId, role },
      { expiresIn: this.refreshTokenExpiresIn },
    );

    await this.redis.set(
      `accessToken:${userId}`,
      accessToken,
      this.redisAccessTokenTTL,
    );

    await this.redis.set(
      `refreshToken:${userId}`,
      refreshToken,
      this.redisRefreshTokenTTL,
    );

    return { accessToken, refreshToken };
  }

  private async validateStoredRefreshToken(
    userId: string,
    refreshToken: string,
  ): Promise<void> {
    if (!userId || !refreshToken) {
      throw new UnauthorizedException('Invalid refresh token payload');
    }

    const storedToken = await this.redis.get(`refreshToken:${userId}`);

    if (!storedToken || storedToken !== refreshToken) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    await this.redis.del(`refreshToken:${userId}`);
  }
}
