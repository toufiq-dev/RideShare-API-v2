import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from 'src/core/database/prisma.service';
import {
  AppUpdateDto,
  CreateSubscriptionTypeDto,
  CreateSupportStuffDto,
  UpdateSubscriptionTypeDto,
  VerifyEmailDto,
  CreateSupportRoleDto,
  LoginDto,
  CreateAdminDto,
  VerifyDriverDto,
  VerificationType,
} from './dto/admin.dto';
import { randomInt } from 'crypto';
import {
  AppPlatform,
  UserRole,
  UserStatus,
  VerificationStatus,
} from '@prisma/client';
import bcrypt from 'bcrypt';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { RedisService } from 'src/core/cache/redis.service';
import { RedisKeys } from 'src/core/cache/redis-keys';

@Injectable()
export class AdminService {
  private readonly accessTokenExpiresIn: string;
  private readonly refreshTokenExpiresIn: string;
  private readonly redisAccessTokenTTL: number;
  private readonly redisRefreshTokenTTL: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly redis: RedisService,
  ) {
    this.accessTokenExpiresIn = this.configService.get<string>(
      'jwt.accessTokenExpiresIn',
    );
    this.refreshTokenExpiresIn = this.configService.get<string>(
      'jwt.refreshTokenExpiresIn',
    );
    this.redisAccessTokenTTL = this.configService.get<number>(
      'redis.accessTokenTTL',
    );
    this.redisRefreshTokenTTL = this.configService.get<number>(
      'redis.refreshTokenTTL',
    );
  }

  async updateAppVersion(appUpdateDto: AppUpdateDto) {
    const {
      adCustomerVersion,
      adDriverVersion,
      iosCustomerVersion,
      appDescription,
    } = appUpdateDto;

    try {
      const data = await this.prisma.platform.upsert({
        where: {
          appDescription,
        },
        update: {
          adDriverVersion,
          adCustomerVersion,
          iosCustomerVersion,
          appDescription,
        },
        create: {
          adDriverVersion,
          adCustomerVersion,
          iosCustomerVersion,
          appDescription,
        },
      });

      return {
        message: 'App version updated successfully.',
        data,
      };
    } catch (error) {
      console.error(error);
      throw error;
    }
  }

  async getAppVersion(platform: AppPlatform) {
    try {
      const data = await this.prisma.platform.findUnique({
        where: {
          appDescription: platform,
        },
      });

      return {
        message: 'App version fetched successfully.',
        data,
      };
    } catch (error) {
      console.error(error);
      throw error;
    }
  }

  async login(loginDto: LoginDto) {
    const { email, password } = loginDto;

    try {
      const user = await this.prisma.user.findUnique({
        where: { email },
      });
      if (!user) {
        throw new UnauthorizedException('Invalid email or password');
      }

      let roledUser = null;
      if (user.role === UserRole.ADMIN) {
        roledUser = await this.prisma.admin.findUnique({
          where: {
            userId: user.id,
          },
          select: {
            password: true,
          },
        });
      } else if (user.role === UserRole.SUPPORT) {
        roledUser = await this.prisma.support.findUnique({
          where: {
            userId: user.id,
          },
          select: {
            password: true,
          },
        });
      } else if (user.role === UserRole.SUPER_ADMIN) {
        roledUser = await this.prisma.superAdmin.findUnique({
          where: {
            userId: user.id,
          },
          select: {
            password: true,
          },
        });
      }

      const isPasswordValid = roledUser
        ? await bcrypt.compare(password, roledUser.password)
        : null;

      if (!isPasswordValid) {
        throw new UnauthorizedException('Invalid email or password');
      }

      return {
        message: 'Credentials verified successfully. Verify Email to login.',
        data: {
          email: user.email,
        },
      };
    } catch (error) {
      console.error(error);
      throw error;
    }
  }

  async getUserInfo(userId: string) {
    try {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
      });

      if (!user) {
        throw new UnauthorizedException('User not found');
      }

      if (user.role === UserRole.ADMIN) {
        const admin = await this.prisma.admin.findUnique({
          where: { userId },
          select: {
            name: true,
          },
        });

        return {
          message: 'Admin info fetched successfully.',
          data: {
            name: admin.name,
            role: user.role,
          },
        };
      } else if (user.role === UserRole.SUPPORT) {
        const support = await this.prisma.support.findUnique({
          where: { userId },
          select: {
            name: true,
            phone: true,
            referralCode: true,
            supportRole: {
              select: {
                name: true,
                description: true,
                supportPermissions: {
                  select: {
                    menuKey: true,
                    isVisible: true,
                  },
                },
              },
            },
          },
        });

        return {
          message: 'Support info fetched successfully.',
          data: support,
        };
      } else if (user.role === UserRole.SUPER_ADMIN) {
        const superAdmin = await this.prisma.superAdmin.findUnique({
          where: { userId },
          select: {
            name: true,
          },
        });

        return {
          message: 'Super admin info fetched successfully.',
          data: {
            name: superAdmin.name,
            role: user.role,
          },
        };
      }
    } catch (error) {
      console.error(error);
      throw error;
    }
  }

  async verifyEmail(verifyEmailDto: VerifyEmailDto) {
    const { email, otp } = verifyEmailDto;

    try {
      const otpFromRedis = await this.redis.get(
        `${RedisKeys.EMAIL_VERIFICATION_OTP}${email}`,
      );

      if (!otpFromRedis || otpFromRedis !== otp) {
        throw new UnauthorizedException('Invalid or Expired OTP');
      }

      const admin = await this.prisma.user.findUnique({
        where: { email },
      });

      const accessToken = await this.jwtService.signAsync(
        { userId: admin.id, role: UserRole.ADMIN },
        { expiresIn: this.accessTokenExpiresIn },
      );

      const refreshToken = await this.jwtService.signAsync(
        { userId: admin.id, role: UserRole.ADMIN },
        { expiresIn: this.refreshTokenExpiresIn },
      );

      await this.redis.set(
        `${RedisKeys.ACCESS_TOKEN}${admin.id}`,
        accessToken,
        this.redisAccessTokenTTL,
      );
      await this.redis.set(
        `${RedisKeys.REFRESH_TOKEN}${admin.id}`,
        refreshToken,
        this.redisRefreshTokenTTL,
      );

      return {
        message: 'Admin verified successfully.',
        data: {
          accessToken,
          refreshToken,
        },
      };
    } catch (error) {
      console.error(error);
      throw error;
    }
  }

  async createAdmin(createAdminDto: CreateAdminDto) {
    const { email, password } = createAdminDto;

    try {
      const existingUser = await this.prisma.user.findUnique({
        where: {
          email,
        },
      });
      if (existingUser) {
        throw new BadRequestException('Admin already exists');
      }

      const user = await this.prisma.user.create({
        data: {
          role: UserRole.ADMIN,
          email,
        },
      });

      const hashedPassword = await bcrypt.hash(password, 10);

      await this.prisma.admin.create({
        data: {
          password: hashedPassword,
          name: 'Admin',
          userId: user.id,
        },
      });

      return {
        message: 'Admin created successfully.',
        data: {
          email: user.email,
        },
      };
    } catch (error) {
      console.error(error);
      throw error;
    }
  }

  async getMenuPermissions(page: number, pageSize: number) {
    try {
      const skip = (page - 1) * pageSize;
      const totalCount = await this.prisma.supportPermission.count();
      const totalPages = Math.ceil(totalCount / pageSize);
      const hasNextPage = page < totalPages;
      const hasPrevPage = page > 1;
      const data = await this.prisma.supportPermission.findMany({
        skip,
        take: pageSize,
      });

      return {
        message: 'Menu permissions fetched successfully.',
        data: {
          menuPermissions: data,
          pagination: {
            totalItems: totalCount,
            totalPages,
            currentPage: page,
            pageSize,
            hasNextPage,
            hasPrevPage,
          },
        },
      };
    } catch (error) {
      console.error(error);
      throw error;
    }
  }

  async getSupportRoles(page: number, pageSize: number) {
    try {
      const skip = (page - 1) * pageSize;
      const totalCount = await this.prisma.supportRole.count();
      const totalPages = Math.ceil(totalCount / pageSize);
      const hasNextPage = page < totalPages;
      const hasPrevPage = page > 1;

      const data = await this.prisma.supportRole.findMany({
        skip,
        take: pageSize,
      });

      return {
        message: 'Support roles fetched successfully.',
        data: {
          supportRoles: data,
          pagination: {
            totalItems: totalCount,
            totalPages,
            currentPage: page,
            pageSize,
            hasNextPage,
            hasPrevPage,
          },
        },
      };
    } catch (error) {
      console.error(error);
      throw error;
    }
  }

  async createSupportRole(createSupportRoleDto: CreateSupportRoleDto) {
    const { name, supportPermissionIds, description } = createSupportRoleDto;

    try {
      const existingRole = await this.prisma.supportRole.findFirst({
        where: {
          name: {
            equals: name,
            mode: 'insensitive',
          },
        },
      });

      if (existingRole) {
        throw new BadRequestException(`Role ${name} already exists`);
      }

      const data = await this.prisma.supportRole.create({
        data: {
          name,
          description,
          supportPermissions: {
            connect: supportPermissionIds.map((id) => ({ id })),
          },
        },
      });

      return {
        message: 'Support role created successfully.',
        data,
      };
    } catch (error) {
      console.error(error);
      throw error;
    }
  }

  async createSupportStuff(createSupportStuffDto: CreateSupportStuffDto) {
    const { name, phone, supportRoleId, email, password } =
      createSupportStuffDto;

    try {
      const user = await this.prisma.user.create({
        data: {
          role: UserRole.SUPPORT,
          email,
        },
      });

      const hashedPassword = await bcrypt.hash(password, 10);

      const data = await this.prisma.support.create({
        data: {
          name,
          phone,
          referralCode: randomInt(10000, 1000000).toString(),
          userId: user.id,
          supportRoleId,
          password: hashedPassword,
        },
      });

      return {
        message: 'Support stuff created successfully.',
        data: {
          email: user.email,
        },
      };
    } catch (error) {
      console.error(error);
      throw error;
    }
  }

  async getSupportStuffs(page: number, pageSize: number) {
    try {
      const skip = (page - 1) * pageSize;

      const totalCount = await this.prisma.support.count();

      const supportStuffs = await this.prisma.support.findMany({
        select: {
          id: true,
          name: true,
          phone: true,
          referralCode: true,
          supportRole: {
            select: {
              name: true,
              supportPermissions: {
                select: {
                  menuKey: true,
                },
              },
            },
          },
        },
        skip,
        take: pageSize,
      });

      const totalPages = Math.ceil(totalCount / pageSize);
      const hasNextPage = page < totalPages;
      const hasPrevPage = page > 1;

      return {
        message: 'Support stuffs fetched successfully.',
        data: {
          supportStuffs,
          pagination: {
            totalItems: totalCount,
            totalPages,
            currentPage: page,
            pageSize,
            hasNextPage,
            hasPrevPage,
          },
        },
      };
    } catch (error) {
      console.error(error);
      throw error;
    }
  }

  async createSubscriptionType(
    createSubscriptionTypeDto: CreateSubscriptionTypeDto,
  ) {
    const { name, coins, price, priceBeforeDiscount } =
      createSubscriptionTypeDto;

    try {
      const data = await this.prisma.subscription.create({
        data: {
          name,
          coins,
          price,
          priceBeforeDiscount,
        },
      });

      return {
        message: 'Subscription type created successfully.',
        data,
      };
    } catch (error) {
      console.error(error);
      throw error;
    }
  }

  async getSubscriptionTypes() {
    try {
      const data = await this.prisma.subscription.findMany();

      return {
        message: 'Subscription types fetched successfully.',
        data,
      };
    } catch (error) {
      console.error(error);
      throw error;
    }
  }

  async updateSubscriptionType(
    id: string,
    updateSubscriptionTypeDto: UpdateSubscriptionTypeDto,
  ) {
    const { name, coins, price, priceBeforeDiscount } =
      updateSubscriptionTypeDto;

    const data = await this.prisma.subscription.update({
      where: {
        id,
      },
      data: {
        name,
        coins,
        price,
        priceBeforeDiscount,
      },
    });

    return {
      message: 'Subscription type updated successfully.',
      data,
    };
  }

  async getDriverList(page: number, pageSize: number) {
    try {
      const skip = (page - 1) * pageSize;

      const totalCount = await this.prisma.pilot.count();
      const activeCount = await this.prisma.pilot.count({
        where: {
          user: {
            status: UserStatus.ACTIVE,
          },
        },
      });
      const pendingCount = await this.prisma.pilot.count({
        where: {
          isDLVerified: {
            not: VerificationStatus.APPROVED,
          },
        },
      });
      const suspendedCount = await this.prisma.pilot.count({
        where: {
          user: {
            status: UserStatus.SUSPENDED,
          },
        },
      });

      const pilots = await this.prisma.pilot.findMany({
        select: {
          id: true,
          phone: true,
          createdAt: true,
          drivingLicense: {
            select: {
              nameOnLicense: true,
            },
          },
          user: {
            select: {
              country: true,
              status: true,
            },
          },
          wallet: {
            select: {
              balance: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
        skip,
        take: pageSize,
      });

      const pilotsWithEarnings = await Promise.all(
        pilots.map(async (pilot) => {
          const earningsData = await this.prisma.pilotTrips.aggregate({
            where: {
              pilotId: pilot.id,
            },
            _sum: {
              amount: true,
            },
            _count: {
              id: true,
            },
          });

          return {
            ...pilot,
            totalEarnings: Number(earningsData._sum.amount || 0),
            totalTrips: earningsData._count.id,
          };
        }),
      );

      // Calculate pagination metadata
      const totalPages = Math.ceil(totalCount / pageSize);
      const hasNextPage = page < totalPages;
      const hasPrevPage = page > 1;

      return {
        message: 'Driver list fetched successfully.',
        data: {
          pilots: pilotsWithEarnings,
          totalPilots: totalCount,
          activePilots: activeCount,
          pendingPilots: pendingCount,
          suspendedPilots: suspendedCount,
          pagination: {
            totalItems: totalCount,
            totalPages,
            currentPage: page,
            pageSize,
            hasNextPage,
            hasPrevPage,
          },
        },
      };
    } catch (error) {
      console.error(error);
      throw error;
    }
  }

  async getDriverDetails(id: string) {
    try {
      const data = await this.prisma.pilot.findUnique({
        where: { id },
        select: {
          id: true,
          phone: true,
          isDLVerified: true,
          isRCVerified: true,
          isNidVerified: true,
          isSelfieVerified: true,
          isVehicleOwnersNidVerified: true,
          isNumberPlateVerified: true,
          isTaxTokenVerified: true,
          isPanCardVerified: true,
          isAadhaarVerified: true,
          isFairCoinAvailed: true,
          drivingLicense: {
            select: {
              dateOfBirth: true,
            },
          },
          vehicle: {
            select: {
              regNo: true,
              model: true,
              vehicleTypeBD: {
                select: {
                  name: true,
                  passengerCapacity: true,
                },
              },
            },
          },
        },
      });

      return {
        message: 'Driver details fetched successfully.',
        data,
      };
    } catch (error) {
      console.error(error);
      throw error;
    }
  }

  async getDriverVerification(page: number, pageSize: number) {
    try {
      const skip = (page - 1) * pageSize;

      const totalCount = await this.prisma.pilot.count();

      const pilots = await this.prisma.pilot.findMany({
        select: {
          id: true,
          phone: true,
          isDLVerified: true,
          isRCVerified: true,
          isNidVerified: true,
          isSelfieVerified: true,
          isVehicleOwnersNidVerified: true,
          isNumberPlateVerified: true,
          isTaxTokenVerified: true,
        },
        orderBy: {
          createdAt: 'desc',
        },
        skip,
        take: pageSize,
      });

      // Calculate pagination metadata
      const totalPages = Math.ceil(totalCount / pageSize);
      const hasNextPage = page < totalPages;
      const hasPrevPage = page > 1;

      return {
        message: 'Driver verification fetched successfully.',
        data: {
          pilots,
          pagination: {
            totalItems: totalCount,
            totalPages,
            currentPage: page,
            pageSize,
            hasNextPage,
            hasPrevPage,
          },
        },
      };
    } catch (error) {
      console.error(error);
      throw error;
    }
  }

  async verifyDriver(userId: string, verifyDriverDto: VerifyDriverDto) {
    const {
      driverId,
      verificationStatus,
      verificationDocument,
      cancellationReason,
    } = verifyDriverDto;

    try {
      // const user = await this.prisma.user.findUnique({
      //   where: { id: userId },
      // });
      // if (!user) {
      //   throw new UnauthorizedException('User not found');
      // }

      // if (user.role !== UserRole.ADMIN && user.role !== UserRole.SUPER_ADMIN) {
      //   throw new UnauthorizedException('User not authorized');
      // }

      const pilot = await this.prisma.pilot.findUnique({
        where: { id: driverId },
      });
      if (!pilot) {
        throw new NotFoundException('Driver not found');
      }

      if (verificationDocument === VerificationType.isNidVerified) {
        if (verificationStatus === VerificationStatus.REJECTED) {
          await this.prisma.pilot.update({
            where: { id: driverId },
            data: {
              isNidVerified: verificationStatus,
              nidRejectionReason: cancellationReason,
            },
          });

          return {
            message: 'Driver verification updated successfully.',
            data: {
              verificationStatus,
            },
          };
        }

        await this.prisma.pilot.update({
          where: { id: driverId },
          data: {
            isNidVerified: verificationStatus,
          },
        });

        return {
          message: 'Driver verification updated successfully.',
          data: {
            verificationStatus,
          },
        };
      } else if (verificationDocument === VerificationType.isDlVerified) {
        if (verificationStatus === VerificationStatus.REJECTED) {
          await this.prisma.pilot.update({
            where: { id: driverId },
            data: {
              isDLVerified: verificationStatus,
              dlRejectionReason: cancellationReason,
            },
          });

          return {
            message: 'Driver verification updated successfully.',
            data: {
              verificationStatus,
            },
          };
        }

        await this.prisma.pilot.update({
          where: { id: driverId },
          data: {
            isDLVerified: verificationStatus,
          },
        });

        return {
          message: 'Driver verification updated successfully.',
          data: {
            verificationStatus,
          },
        };
      } else if (verificationDocument === VerificationType.isSelfieVerified) {
        if (verificationStatus === VerificationStatus.REJECTED) {
          await this.prisma.pilot.update({
            where: { id: driverId },
            data: {
              isSelfieVerified: verificationStatus,
              selfieRejectionReason: cancellationReason,
            },
          });

          return {
            message: 'Driver verification updated successfully.',
            data: {
              verificationStatus,
            },
          };
        }

        await this.prisma.pilot.update({
          where: { id: driverId },
          data: {
            isSelfieVerified: verificationStatus,
          },
        });

        return {
          message: 'Driver verification updated successfully.',
          data: {
            verificationStatus,
          },
        };
      } else if (
        verificationDocument === VerificationType.isVehicleOwnersNidVerified
      ) {
        if (verificationStatus === VerificationStatus.REJECTED) {
          await this.prisma.pilot.update({
            where: { id: driverId },
            data: {
              isVehicleOwnersNidVerified: verificationStatus,
              vehicleOwnersNidRejectionReason: cancellationReason,
            },
          });

          return {
            message: 'Driver verification updated successfully.',
            data: {
              verificationStatus,
            },
          };
        }
        await this.prisma.pilot.update({
          where: { id: driverId },
          data: {
            isVehicleOwnersNidVerified: verificationStatus,
          },
        });

        return {
          message: 'Driver verification updated successfully.',
          data: {
            verificationStatus,
          },
        };
      } else if (verificationDocument === VerificationType.isRcVerified) {
        if (verificationStatus === VerificationStatus.REJECTED) {
          await this.prisma.pilot.update({
            where: { id: driverId },
            data: {
              isRCVerified: verificationStatus,
              rcRejectionReason: cancellationReason,
            },
          });

          return {
            message: 'Driver verification updated successfully.',
            data: {
              verificationStatus,
            },
          };
        }

        await this.prisma.pilot.update({
          where: { id: driverId },
          data: {
            isRCVerified: verificationStatus,
          },
        });

        return {
          message: 'Driver verification updated successfully.',
          data: {
            verificationStatus,
          },
        };
      } else if (
        verificationDocument === VerificationType.isNumberPlateVerified
      ) {
        if (verificationStatus === VerificationStatus.REJECTED) {
          await this.prisma.pilot.update({
            where: { id: driverId },
            data: {
              isNumberPlateVerified: verificationStatus,
              numberPlateRejectionReason: cancellationReason,
            },
          });

          return {
            message: 'Driver verification updated successfully.',
            data: {
              verificationStatus,
            },
          };
        }

        await this.prisma.pilot.update({
          where: { id: driverId },
          data: {
            isNumberPlateVerified: verificationStatus,
          },
        });

        return {
          message: 'Driver verification updated successfully.',
          data: {
            verificationStatus,
          },
        };
      } else if (verificationDocument === VerificationType.isTaxTokenVerified) {
        if (verificationStatus === VerificationStatus.REJECTED) {
          await this.prisma.pilot.update({
            where: { id: driverId },
            data: {
              isTaxTokenVerified: verificationStatus,
              taxTokenRejectionReason: cancellationReason,
            },
          });

          return {
            message: 'Driver verification updated successfully.',
            data: {
              verificationStatus,
            },
          };
        }

        await this.prisma.pilot.update({
          where: { id: driverId },
          data: {
            isTaxTokenVerified: verificationStatus,
          },
        });

        return {
          message: 'Driver verification updated successfully.',
          data: {
            verificationStatus,
          },
        };
      }

      return {
        message: 'Driver verification updated successfully.',
        data: {
          verificationStatus,
        },
      };
    } catch (error) {
      console.error(error);
      throw error;
    }
  }

  async getNid() {
    try {
      const data = await this.prisma.pilot.findMany({
        where: {
          isNidVerified: {
            not: VerificationStatus.APPROVED,
          },
        },
        select: {
          nidFrontSideUrl: true,
          nidBackSideUrl: true,
        },
        orderBy: {
          isNidVerified: 'asc',
        },
      });

      return {
        message: 'NID document fetched successfully',
        data,
      };
    } catch (error) {
      console.error(error);
      throw error;
    }
  }

  async getNumberPlates() {
    try {
      const data = await this.prisma.pilot.findMany({
        where: {
          isNumberPlateVerified: {
            not: VerificationStatus.APPROVED,
          },
        },
        select: {
          numberPlateUrl: true,
        },
        orderBy: {
          isNumberPlateVerified: 'asc',
        },
      });

      return {
        message: 'Number plate document fetched successfully',
        data,
      };
    } catch (error) {
      console.error(error);
      throw error;
    }
  }
}
