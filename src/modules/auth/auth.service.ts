import { randomInt } from 'node:crypto';
import {
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from 'src/core/database/prisma.service';
import { RedisService } from 'src/core/cache/redis.service';
import { Msg91Util } from 'src/core/utils/msg91.util';
import { JwtService } from '@nestjs/jwt';
import {
  SendOtpDto,
  VerifyOtpDto,
  CompleteCustomerOnboardingDto,
  RefreshTokenDto,
  RoleEnum,
  FindPilotDto,
} from './dto/auth.dto';

@Injectable()
export class AuthService {
  private readonly accessTokenExpiresIn: string;
  private readonly refreshTokenExpiresIn: string;
  private readonly jwtSecret: string;
  private readonly redisRefreshTokenTTL: number;
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly msg91: Msg91Util,
  ) {
    this.accessTokenExpiresIn = this.configService.get<string>(
      'jwt.accessTokenExpiresIn',
    );
    this.refreshTokenExpiresIn = this.configService.get<string>(
      'jwt.refreshTokenExpiresIn',
    );
    this.jwtSecret = this.configService.get<string>('jwt.secret');
    this.redisRefreshTokenTTL = this.configService.get<number>(
      'redis.refreshTokenTTL',
    );
  }

  async sendOtp(sendOtpDto: SendOtpDto) {
    const { language, phone, referralCode } = sendOtpDto;

    const Language = await this.prisma.languages.findUnique({
      where: { name: language },
    });
    if (!Language) {
      throw new NotFoundException('Language not found');
    }

    const otp = randomInt(1000, 10000).toString();
    await this.redis.set(`otp:${phone}`, otp, 300);
    await this.redis.set(`languageId:${phone}`, Language.id, 300);

    // const requestId = await this.msg91.sendOTP(phone);

    // await this.redis.set(`requestId:${phone}`, requestId, 300);

    return {
      message: 'OTP sent to your phone successfully',
      data: {
        otp,
        // requestId
      },
    };
  }

  async verifyOtp(verifyOtpDto: VerifyOtpDto) {
    const { phone, otp, role } = verifyOtpDto;

    try {
      const languageId = await this.validateOtpRedis(phone, otp);

      // const languageId = await this.validateOtp(phone, otp);

      const { user, customer, pilot, isNewUser } = await this.findOrCreateUser(
        phone,
        role,
        languageId,
      );

      const tokens = await this.generateTokens(user);

      return {
        message: 'OTP verified successfully',
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

    const { userId, version } = this.decodeRefreshToken(refreshToken);

    await this.validateStoredRefreshToken(userId, refreshToken);

    const user = await this.validateUserTokenVersion(userId, version);

    const updatedUser = await this.incrementUserTokenVersion(
      userId,
      user.authTokenVersion,
    );

    const tokens = await this.generateTokens(updatedUser);

    return { data: tokens };
  }

  async completeOnboarding(
    userId: string,
    customerOnboardingDto: CompleteCustomerOnboardingDto,
  ) {
    const { name, email } = customerOnboardingDto;

    const user = await this.findUserById(userId);

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const updatedUser = await this.prisma.user.update({
      where: { id: userId },
      data: {
        name,
        email,
      },
    });

    return {
      message: 'Onboarding completed successfully',
      data: updatedUser,
    };
  }

  async findMyAccount(findPilotDto: FindPilotDto) {
    const { phone } = findPilotDto;
    const pilot = await this.prisma.pilot.findUnique({
      where: { phone },
      include: {
        drivingLicense: true,
      },
    });

    if (!pilot) {
      throw new NotFoundException('Pilot not found');
    }

    return {
      message: 'Pilot found successfully',
      data: pilot,
    };
  }

  private async findUserById(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return user;
  }

  private async validateOtpRedis(phone: string, otp: string) {
    const storedOtp = await this.redis.get(`otp:${phone}`);

    if (!storedOtp || storedOtp !== otp) {
      throw new UnauthorizedException('Invalid or expired OTP');
    }

    const languageId = await this.redis.get(`languageId:${phone}`);

    // const isVerified = await this.msg91.verifyOtp(phone, otp);
    // if (!isVerified) {
    //   throw new UnauthorizedException('Invalid or expired OTP');
    // }

    await this.redis.del(`otp:${phone}`);
    await this.redis.del(`languageId:${phone}`);

    return languageId;
  }

  private async validateOtp(phone: string, otp: string) {
    const request_id = await this.redis.get(`requestId:${phone}`);

    const isVerified = await this.msg91.verifyOTP(phone, otp, request_id);
    if (!isVerified) {
      throw new UnauthorizedException('Invalid or expired OTP');
    }

    const languageId = await this.redis.get(`languageId:${phone}`);

    return languageId;
  }

  private async findOrCreateUser(
    phone: string,
    role: RoleEnum,
    languageId: string,
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
          authTokenVersion: 1,
        },
      });
      isNewUser = true;
    }

    if (role === RoleEnum.CUSTOMER && !customer) {
      customer = await this.prisma.customer.create({
        data: {
          phone,
          userId: user.id,
          languageId,
        },
      });
      isNewUser = true;
    } else if (role === RoleEnum.PILOT && !pilot) {
      pilot = await this.prisma.pilot.create({
        data: {
          phone,
          userId: user.id,
          languageId,
        },
      });
      isNewUser = true;
    }

    return { user, customer, pilot, isNewUser };
  }

  private async generateTokens(user) {
    const accessToken = this.jwtService.sign(
      { userId: user.id, role: user.role, version: user.authTokenVersion },
      { expiresIn: this.accessTokenExpiresIn },
    );

    const refreshToken = this.jwtService.sign(
      { userId: user.id, version: user.authTokenVersion },
      { expiresIn: this.refreshTokenExpiresIn },
    );

    await this.redis.set(
      `refreshToken:${user.id}`,
      refreshToken,
      this.redisRefreshTokenTTL,
    );

    return { accessToken, refreshToken };
  }

  private decodeRefreshToken(refreshToken: string) {
    try {
      return this.jwtService.verify(refreshToken, { secret: this.jwtSecret });
    } catch {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }
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

  private async validateUserTokenVersion(userId: string, version: number) {
    const user = await this.findUserById(userId);

    if (!user || user.authTokenVersion !== version) {
      throw new UnauthorizedException('Token has been invalidated');
    }
    return user;
  }

  private async incrementUserTokenVersion(
    userId: string,
    currentVersion: number,
  ) {
    const newVersion = currentVersion + 1;
    return await this.prisma.user.update({
      where: { id: userId },
      data: { authTokenVersion: newVersion },
    });
  }
}
