import { randomInt } from 'node:crypto';
import {
  Injectable,
  NotFoundException,
  BadRequestException,
  UnauthorizedException,
} from '@nestjs/common';
import { instanceToPlain } from 'class-transformer';
import { PrismaService } from 'src/core/database/prisma.service';
import {
  CreateSavedPlaceDto,
  UpdateSavedPlaceDto,
  CompleteCustomerOnboardingDto,
  UpdateCustomerNameDto,
} from './dto/customer.dto';
import { RideGateway } from '../ride/ride.gateway';
import { RedisService } from 'src/core/cache/redis.service';
import { OTPService } from 'src/core/utils/otp.util';
import { UpdatePhoneDto, VerifyPhoneDto } from 'src/common/dto/common.dto';

@Injectable()
export class CustomerService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly otpService: OTPService,
    private readonly rideGateway: RideGateway,
  ) {}

  async getCustomer(userId: string) {
    try {
      const data = await this.prisma.customer.findUnique({
        where: {
          userId,
        },
        include: {
          language: true,
        },
      });

      if (!data) {
        throw new NotFoundException('Customer not found.');
      }

      return {
        message: 'Customer fetched successfully.',
        data,
      };
    } catch (error) {
      console.error(error);
      throw error;
    }
  }

  async completeOnboarding(
    userId: string,
    customerOnboardingDto: CompleteCustomerOnboardingDto,
  ) {
    const { name, email } = customerOnboardingDto;

    try {
      const user = await this.prisma.user.findUnique({ where: { id: userId } });
      if (!user) {
        throw new NotFoundException('User not found.');
      }

      const customer = await this.prisma.customer.findUnique({
        where: { userId: user.id },
      });
      if (customer.isAlreadyRegistered) {
        throw new BadRequestException('Customer already Onboarded.');
      }

      const data = await this.prisma.customer.update({
        where: { userId: user.id },
        data: {
          name,
          email,
          isAlreadyRegistered: true,
        },
      });

      return {
        message: 'Onboarding completed successfully.',
        data,
      };
    } catch (error) {
      console.error(error);
      throw error;
    }
  }

  async updateName(
    userId: string,
    updateCustomerNameDto: UpdateCustomerNameDto,
  ) {
    const { name } = updateCustomerNameDto;

    try {
      const customer = await this.prisma.customer.findUnique({
        where: {
          userId,
        },
      });

      if (!customer) {
        throw new NotFoundException('Customer not found.');
      }

      const data = await this.prisma.customer.update({
        where: {
          userId,
        },
        data: {
          name,
        },
      });

      return {
        message: 'Customer name updated successfully.',
        data,
      };
    } catch (error) {
      console.error(error);
      throw error;
    }
  }

  async updatePhone(userId: string, updateCustomerPhoneDto: UpdatePhoneDto) {
    const { phone } = updateCustomerPhoneDto;

    try {
      const customer = await this.prisma.customer.findUnique({
        where: {
          userId,
        },
      });
      if (!customer) {
        throw new NotFoundException('Customer not found.');
      }

      const otp = randomInt(1000, 10000).toString();
      await this.redis.set(`otp:${phone}`, otp, 300);

      // const requestId = await this.otpService.sendOTP(phone);
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

  async verifyPhone(userId: string, verifyCustomerPhoneDto: VerifyPhoneDto) {
    const { phone, otp } = verifyCustomerPhoneDto;

    try {
      const storedOtp = await this.redis.get(`otp:${phone}`);

      if (!storedOtp || storedOtp !== otp) {
        throw new UnauthorizedException('Invalid or expired OTP.');
      }
      await this.redis.del(`otp:${phone}`);

      const data = await this.prisma.customer.update({
        where: {
          userId,
        },
        data: {
          phone,
        },
      });

      return {
        message: 'Phone number updated successfully.',
        data,
      };
    } catch (error) {
      console.error(error);
      throw error;
    }
  }

  async createSavedPlace(
    userId: string,
    createSavedPlacesDto: CreateSavedPlaceDto,
  ) {
    const { name, address, location, type } = createSavedPlacesDto;

    try {
      const customer = await this.prisma.customer.findUnique({
        where: {
          userId,
        },
      });

      if (!customer) {
        throw new NotFoundException('Customer not found.');
      }

      const data = await this.prisma.savedPlace.create({
        data: {
          customerId: customer.id,
          name,
          address,
          type,
          location: location ? instanceToPlain(location) : null,
        },
      });

      return {
        message: 'Saved address created successfully.',
        data,
      };
    } catch (error) {
      console.error(error);
      throw error;
    }
  }

  async getSavedPlaces(userId: string) {
    try {
      const customer = await this.prisma.customer.findUnique({
        where: {
          userId,
        },
      });

      if (!customer) {
        throw new NotFoundException('Customer not found.');
      }

      const data = await this.prisma.savedPlace.findMany({
        where: {
          customerId: customer.id,
        },
      });

      if (!data) {
        throw new NotFoundException('Saved places not found.');
      }

      this.rideGateway.server.emit('savedPlaces', {
        message: 'Saved places fetched successfully.',
        data,
      });

      return {
        message: 'Saved places fetched successfully.',
        data,
      };
    } catch (error) {
      console.error(error);
      throw error;
    }
  }

  async updateSavedPlace(
    id: string,
    userId: string,
    updateSavedPlaceDto: UpdateSavedPlaceDto,
  ) {
    const { name, address, location, type } = updateSavedPlaceDto;

    try {
      const customer = await this.prisma.customer.findUnique({
        where: {
          userId,
        },
      });

      if (!customer) {
        throw new NotFoundException('Customer not found.');
      }

      const savedPlace = await this.prisma.savedPlace.findUnique({
        where: {
          id,
        },
      });

      if (!savedPlace) {
        throw new NotFoundException('Saved place not found.');
      } else {
        const data = await this.prisma.savedPlace.update({
          where: {
            id,
          },
          data: {
            name,
            address,
            type,
            location: location ? instanceToPlain(location) : null,
          },
        });

        return {
          message: 'Saved place updated successfully.',
          data,
        };
      }
    } catch (error) {
      console.error(error);
      throw error;
    }
  }

  async deleteSavedPlace(id: string, userId: string) {
    try {
      const customer = await this.prisma.customer.findUnique({
        where: {
          userId,
        },
      });

      if (!customer) {
        throw new NotFoundException('Customer not found.');
      }

      const savedPlace = await this.prisma.savedPlace.findUnique({
        where: {
          id,
        },
      });

      if (!savedPlace) {
        throw new NotFoundException('Saved place not found.');
      }

      await this.prisma.savedPlace.delete({
        where: {
          id,
        },
      });

      return {
        message: 'Saved place deleted successfully.',
      };
    } catch (error) {
      console.error(error);
      throw error;
    }
  }

  async getVehicleCategories() {
    const data = await this.prisma.vehicleType.findMany();

    return {
      message: 'Vehicle categories fetched successfully.',
      data,
    };
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
}
