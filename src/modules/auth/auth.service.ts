import { randomInt } from 'node:crypto';
import {
  Injectable,
  NotFoundException,
  UnauthorizedException,
  BadRequestException,
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
  FindPilotDto,
  RefreshFcmTokenDto,
} from './dto/auth.dto';
import { LocationDto } from 'src/common/dto/common.dto';
import { GeofencingService } from 'src/core/geofencing/geofencing.service';
import { Country, PilotStatus, UserRole, UserStatus } from '@prisma/client';
import { CouponsNames } from '../admin/admin.constants';
import { SocketService } from 'src/core/socket/socket.service';
import { RedisKeys } from 'src/core/cache/redis-keys';

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
    private readonly geofencingService: GeofencingService,
    private readonly socketService: SocketService,
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
      if (
        phone === '+8801412345670' ||
        phone === '+8801412345671' ||
        phone === '+8801412345672' ||
        phone === '+8801412345673' ||
        phone === '+8801412345674' ||
        phone === '+919999999999'
      ) {
        return {
          message: 'OTP sent to your phone successfully.',
          data: {
            otp: '4242',
          },
        };
      }

      const Language = await this.prisma.languages.findUnique({
        where: { name: language },
      });
      if (!Language) {
        throw new NotFoundException('Language not found.');
      }

      let countryCode: Country | null = null;
      if (phone.startsWith('+880')) {
        countryCode = Country.BD;
      } else if (phone.startsWith('+91')) {
        countryCode = Country.IN;
      }

      const otpSent = await this.redis.get(`otpSent:${phone}`);
      if (otpSent) {
        throw new BadRequestException(
          'OTP already sent. Please wait for 3 minutes.',
        );
      }

      const otp = randomInt(1000, 10000).toString();
      // Disable this one when we are using OTP service
      await this.redis.set(`otp:${phone}`, otp, 180);
      await this.redis.set(`countryCode:${phone}`, countryCode, 180);
      await this.redis.set(`languageId:${phone}`, Language.id, 180);
      await this.redis.set(`referralCode:${phone}`, referralCode, 180);

      // Khudebarta OTP
      if (countryCode === Country.BD) {
        const isSent = await this.otpService.sendOTPBD(phone, otp);

        if (!isSent) {
          throw new BadRequestException('Failed to send OTP.');
        }

        await this.redis.set(`otpSent:${phone}`, 'true', 180);

        return {
          message: 'OTP sent to your phone successfully.',
          data: {
            otp: ' ',
          },
        };
      } else if (countryCode === Country.IN) {
        const requestId = await this.otpService.sendOTP(phone);

        await this.redis.set(`requestId:${phone}`, requestId, 300);
      }

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
    const { phone, otp, role, fcmToken } = verifyOtpDto;

    try {
      // For App review in ios and android store START
      if (
        (phone == '+8801412345670' && otp == '4242') ||
        (phone == '+8801412345671' && otp == '4242') ||
        (phone == '+8801412345672' && otp == '4242') ||
        (phone == '+8801412345673' && otp == '4242') ||
        (phone == '+8801412345674' && otp == '4242') ||
        (phone == '+919999999999' && otp == '4242')
      ) {
        let user = null;
        let pilot = null;
        let customer = null;

        if (role === UserRole.PILOT) {
          pilot = await this.prisma.pilot.findUnique({
            where: { phone },
          });

          user = await this.prisma.user.findUnique({
            where: { id: pilot.userId },
          });

          await this.prisma.pilot.update({
            where: { id: pilot.id },
            data: {
              isAlreadyRegistered: true,
            },
          });
        }
        if (role === UserRole.CUSTOMER) {
          customer = await this.prisma.customer.findUnique({
            where: { phone },
          });

          user = await this.prisma.user.findUnique({
            where: { id: customer.userId },
          });

          await this.prisma.customer.update({
            where: { id: customer.id },
            data: {
              isAlreadyRegistered: true,
            },
          });
        }
        if (!user) {
          throw new NotFoundException('User not found.');
        }

        await this.prisma.deviceToken.upsert({
          where: { userId: user.id },
          update: { fcmToken: fcmToken },
          create: { userId: user.id, fcmToken: fcmToken },
        });

        const tokens = await this.generateTokens(user.id, user.role);

        return {
          message: 'OTP verified successfully.',
          data: {
            ...tokens,
            user: role === UserRole.CUSTOMER ? customer : pilot,
          },
        };
      } // For App review in ios and android store END

      const { languageId, refferalCode } = await this.validateOtpRedis(
        phone,
        otp,
      );

      // const { languageId, refferalCode } = await this.validateOtp(phone, otp);
      const countryCode = await this.redis.get(`countryCode:${phone}`);
      const { user, customer, pilot } = await this.findOrCreateUser(
        phone,
        role,
        languageId,
        refferalCode,
        countryCode as Country,
      );

      let isAlreadyRegistered = true;
      if (role === UserRole.CUSTOMER) {
        isAlreadyRegistered = customer.isAlreadyRegistered;
        if (!customer.isAlreadyRegistered) {
          await this.prisma.customer.update({
            where: { id: customer.id },
            data: { isAlreadyRegistered: true },
          });
        }
      } else if (role === UserRole.PILOT) {
        isAlreadyRegistered = pilot.isAlreadyRegistered;
        if (!pilot.isAlreadyRegistered) {
          await this.prisma.pilot.update({
            where: { id: pilot.id },
            data: { isAlreadyRegistered: true },
          });
        }
      }

      const device = await this.prisma.deviceToken.findUnique({
        where: { userId: user.id },
      });

      if (!device) {
        await this.prisma.deviceToken.create({
          data: {
            userId: user.id,
            fcmToken,
          },
        });
      } else if (device.fcmToken !== fcmToken) {
        await this.prisma.deviceToken.update({
          where: { userId: user.id },
          data: {
            fcmToken,
          },
        });
      }

      const tokens = await this.generateTokens(user.id, user.role);

      return {
        message: 'OTP verified successfully.',
        data: {
          ...tokens,
          user: role === UserRole.CUSTOMER ? customer : pilot,
        },
      };
    } catch (error) {
      console.error(error);
      throw error;
    }
  }

  async checkLocation(
    locationDto: LocationDto,
    userId: string,
    role: UserRole,
  ) {
    const { lat, lng } = locationDto;

    try {
      // For App review in ios and android store
      if (role === UserRole.PILOT) {
        const pilot = await this.prisma.pilot.findUnique({
          where: { userId },
        });
        if (!pilot) {
          throw new NotFoundException('Pilot not found.');
        }

        if (pilot.phone === '+919999999999') {
          return {
            data: {
              isInServiceArea: true,
              city: null,
            },
            message: 'Within the service area.',
          };
        }
      }

      const { isInServiceArea, city } = this.geofencingService.isWithinBoundary(
        lat,
        lng,
      );

      return {
        data: {
          isInServiceArea,
          city,
        },
        message: isInServiceArea
          ? 'Within the service area.'
          : 'Outside the service area.',
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

  async refreshFcmToken(
    refreshFcmTokenDto: RefreshFcmTokenDto,
    userId: string,
  ) {
    const { fcmToken } = refreshFcmTokenDto;

    try {
      const device = await this.prisma.deviceToken.findUnique({
        where: { userId: userId },
      });

      if (!device) {
        throw new NotFoundException('Device not found.');
      }

      await this.prisma.deviceToken.update({
        where: { userId: userId },
        data: { fcmToken },
      });

      return {
        message: 'FCM token refreshed successfully.',
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

  async deleteAccount(userId: string) {
    try {
      const user = await this.prisma.user.findUnique({ where: { id: userId } });
      if (!user) {
        throw new NotFoundException('User not found.');
      }

      await this.prisma.user.update({
        where: { id: userId },
        data: { status: UserStatus.DELETED },
      });

      await this.redis.del(`${RedisKeys.ACCESS_TOKEN}${userId}`);
      await this.redis.del(`${RedisKeys.REFRESH_TOKEN}${userId}`);

      return {
        message: 'User deleted successfully.',
      };
    } catch (error) {
      console.error(error);
      throw error;
    }
  }

  async logout(userId: string) {
    try {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { role: true },
      });

      if (!user) {
        throw new NotFoundException('User not found.');
      }

      await this.redis.del(`${RedisKeys.ACCESS_TOKEN}${userId}`);
      await this.redis.del(`${RedisKeys.REFRESH_TOKEN}${userId}`);

      await this.prisma.deviceToken.deleteMany({
        where: { userId },
      });

      const connectionKey = `${RedisKeys.SOCKET_CONNECTION}${userId}`;
      const clientId = await this.redis.get(connectionKey);
      if (clientId) {
        // Disconnect socket if connected
        const sockets = await this.socketService.server.fetchSockets();
        const socket = sockets.find((s) => s.id === clientId);
        if (socket) {
          socket.disconnect(true);
        }
        await this.redis.del(connectionKey);
      }

      if (user.role === UserRole.PILOT) {
        // Remove from geospatial set
        await this.redis.zRem(RedisKeys.PILOT_LOCATION, userId);

        // Clean up active ride if any
        await this.redis.removeActiveRide(userId);

        // Update pilot status to offline
        await this.prisma.pilot.update({
          where: { userId },
          data: { onlineStatus: PilotStatus.OFFLINE },
        });
      }

      return {
        message: 'Logged out successfully.',
      };
    } catch (error) {
      console.error(error);
      throw error;
    }
  }

  async getVehicleRegistrationPoints() {
    const vehicleRegistrationPoints = await this.prisma.systemConfig.findUnique(
      {
        where: { key: 'vehicleRegistrationPoints' },
      },
    );

    const vehicleSeries = await this.prisma.systemConfig.findUnique({
      where: { key: 'vehicleSeries' },
    });

    const data = {
      vehicleRegistrationPoints: vehicleRegistrationPoints.value,
      vehicleSeries: vehicleSeries.value,
    };

    return {
      message: 'Vehicle data fetched successfully.',
      data,
    };
  }

  private async validateOtpRedis(phone: string, otp: string) {
    const storedOtp = await this.redis.get(`otp:${phone}`);
    console.log(storedOtp);
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
    role: UserRole,
    languageId: string,
    referralCode: string,
    countryCode: Country,
  ) {
    let customer = null;
    let pilot = null;
    let user = null;

    const coupon = await this.prisma.coupon.findUnique({
      where: {
        name: CouponsNames.MINI,
      },
    });

    if (role === UserRole.CUSTOMER) {
      customer = await this.prisma.customer.findUnique({
        where: { phone },
      });

      if (customer) {
        user = await this.prisma.user.findUnique({
          where: { id: customer.userId },
        });
      }
    } else if (role === UserRole.PILOT) {
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
          country: countryCode,
        },
      });

      if (role === UserRole.CUSTOMER && !customer) {
        customer = await this.prisma.customer.create({
          data: {
            phone,
            userId: user.id,
            languageId,
            couponId: coupon && coupon.id,
          },
        });
      } else if (role === UserRole.PILOT && !pilot) {
        pilot = await this.prisma.pilot.create({
          data: {
            phone,
            userId: user.id,
            languageId,
            referralCode,
          },
        });

        await this.prisma.user.update({
          where: { id: user.id },
          data: { status: UserStatus.IN_REVIEW },
        });
      }
    }

    return { user, customer, pilot };
  }

  private async generateTokens(userId: string, role: any) {
    // 1. Check if user has existing tokens
    const existingAccessToken = await this.redis.get(
      `${RedisKeys.ACCESS_TOKEN}${userId}`,
    );
    const existingRefreshToken = await this.redis.get(
      `${RedisKeys.REFRESH_TOKEN}${userId}`,
    );

    if (existingAccessToken || existingRefreshToken) {
      await this.forceDisconnectUser(userId);

      // if (role === RoleEnum.PILOT) {
      //   await this.cleanupPilotData(userId);
      // }
    }

    await this.redis.del(`${RedisKeys.ACCESS_TOKEN}${userId}`);
    await this.redis.del(`${RedisKeys.REFRESH_TOKEN}${userId}`);

    const accessToken = await this.jwtService.signAsync(
      { userId, role },
      { expiresIn: this.accessTokenExpiresIn },
    );

    const refreshToken = await this.jwtService.signAsync(
      { userId, role },
      { expiresIn: this.refreshTokenExpiresIn },
    );

    await this.redis.set(
      `${RedisKeys.ACCESS_TOKEN}${userId}`,
      accessToken,
      this.redisAccessTokenTTL,
    );

    await this.redis.set(
      `${RedisKeys.REFRESH_TOKEN}${userId}`,
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

    const storedToken = await this.redis.get(
      `${RedisKeys.REFRESH_TOKEN}${userId}`,
    );

    if (!storedToken || storedToken !== refreshToken) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    await this.redis.del(`${RedisKeys.REFRESH_TOKEN}${userId}`);
  }

  private async forceDisconnectUser(userId: string): Promise<void> {
    try {
      const connectionKey = `${RedisKeys.SOCKET_CONNECTION}${userId}`;
      const existingClientId = await this.redis.get(connectionKey);

      if (existingClientId) {
        const sockets = await this.socketService.server.fetchSockets();
        const oldSocket = sockets.find((s) => s.id === existingClientId);

        if (oldSocket) {
          console.log(
            `Force disconnecting socket ${existingClientId} for user ${userId}`,
          );
          oldSocket.disconnect(true);

          oldSocket.emit('force_logout', {
            message: 'You have been logged out due to login on another device',
            reason: 'MULTIPLE_DEVICE_LOGIN',
          });
        }

        await this.redis.del(connectionKey);
      }
    } catch (error) {
      console.error('Error force disconnecting user:', error);
    }
  }

  private async cleanupPilotData(userId: string): Promise<void> {
    try {
      // 1. Remove from geospatial set
      await this.redis.zRem(RedisKeys.PILOT_LOCATION, userId);

      // 2. Clean up active ride if any
      // await this.redis.removeActiveRide(userId);

      // 3. Update pilot status to offline
      // await this.prisma.pilot.update({
      //   where: { userId },
      //   data: {
      //     onlineStatus: PilotStatus.OFFLINE,
      //     activeBookingId: null,
      //   },
      // });

      console.log(`Cleaned up pilot data for user ${userId}`);
    } catch (error) {
      console.error('Error cleaning up pilot data:', error);
    }
  }
}
