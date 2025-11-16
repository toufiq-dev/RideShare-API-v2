import { randomInt } from 'node:crypto';
import {
  Injectable,
  NotFoundException,
  BadRequestException,
  UnauthorizedException,
} from '@nestjs/common';
import { instanceToPlain } from 'class-transformer';
import { PrismaService } from 'src/core/database/database.service';
import {
  CreateSavedPlaceDto,
  UpdateSavedPlaceDto,
  CompleteCustomerOnboardingDto,
  UpdateCustomerNameDto,
  VehicleCategoryDto,
} from './dto/customer.dto';
import { RedisService } from 'src/core/cache/redis.service';
import { OTPService } from 'src/core/utils/otp.util';
import { VerifyPhoneDto } from 'src/common/dto/common.dto';
import { FareService } from '../fare/fare.service';
import {
  RideType,
  PilotStatus,
  BookingStatus,
  VehicleTypeNameBD,
} from '@prisma/client';
import { CustomerRidePayload } from '../ride/dto/ride.interface';
import { RedisKeys } from 'src/core/cache/redis-keys';
import { TariffService } from '../pricing/tariff.service';
import { MultiplierService } from '../pricing/multiplier.service';
import { TelemetryService } from '../pricing/telemetry.service';
import { h3Cell } from 'src/core/utils/h3.util';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class CustomerService {
  private readonly CITY: string;
  private readonly MU_MIN: number;
  private readonly MU_MAX: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly otpService: OTPService,
    private readonly fareService: FareService,
    private readonly tariffService: TariffService,
    private readonly multService: MultiplierService,
    private readonly telemetry: TelemetryService,
    private readonly configService: ConfigService,
  ) {
    this.CITY = this.configService.get<string>('pricing.city');
    this.MU_MIN = this.configService.get<number>('pricing.MU_MIN');
    this.MU_MAX = this.configService.get<number>('pricing.MU_MAX');
  }

  async getCustomer(userId: string) {
    try {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
      });
      if (!user) {
        throw new NotFoundException('User not found.');
      }

      const data: any = await this.prisma.customer.findUnique({
        where: {
          userId,
        },
        include: {
          user: {
            select: {
              status: true,
            },
          },
          coupon: true,
          language: true,
          activeBooking: {
            include: {
              pilotRating: {
                select: {
                  rating: true,
                },
              },
              vehicleTypeBD: {
                select: {
                  name: true,
                  id: true,
                },
              },
            },
          },
        },
      });

      if (!data) {
        throw new NotFoundException('Customer not found.');
      }

      if (data?.coupon) {
        data.coupon.discount = Number(data.coupon.discount);
      }

      console.log('data.activeBooking', data.activeBooking);

      if (
        data?.activeBooking?.status === BookingStatus.PENDING ||
        data?.activeBooking?.status === BookingStatus.ACCEPTED ||
        data?.activeBooking?.status === BookingStatus.ARRIVED ||
        data?.activeBooking?.status === BookingStatus.ONGOING
      ) {
        let pilot = null;
        if (data.activeBooking?.pilotId) {
          pilot = await this.prisma.pilot.findUnique({
            where: {
              id: data.activeBooking.pilotId,
            },
            select: {
              id: true,
              userId: true,
              selfieUrl: true,
              phone: true,
              averageRating: true,
              currentLocation: true,
              pilotType: true,
              drivingLicense: {
                select: {
                  nameOnLicense: true,
                },
              },
              vehicle: {
                select: {
                  regNo: true,
                  model: true,
                  colour: true,
                  vehicleTypeBD: {
                    select: {
                      name: true,
                    },
                  },
                },
              },
            },
          });
        }
        const pilotLocation = pilot
          ? await this.redis.geoPos(RedisKeys.PILOT_LOCATION, pilot.userId)
          : [null, null];

        const payload: CustomerRidePayload = {
          bookingCode: data.activeBooking.bookingCode,
          bookingId: data.activeBooking.id,
          bookingStatus: data.activeBooking.status,
          estimatedDuration: Number(data.activeBooking.estimatedDuration),
          estimatedDistance: Number(data.activeBooking.estimatedDistance),
          tripDuration: Number(data.activeBooking.duration),
          tripStart: data.activeBooking.tripStart,
          vehicleType: data.activeBooking?.vehicleTypeBD?.name,
          vehicleTypeId: data.activeBooking?.vehicleTypeIdBD,
          createdAt: data?.activeBooking?.createdAt,
          pilot: pilot
            ? {
                pilotId: pilot.id,
                pilotName: pilot.drivingLicense.nameOnLicense,
                profilePicture: pilot.selfieUrl,
                pilotPhone: pilot.phone,
                rating: pilot.averageRating,
                pilotLocation: {
                  lat: pilotLocation[0],
                  lng: pilotLocation[1],
                },
                pilotType: pilot.pilotType,
                vehicleNumber: pilot.vehicle.regNo,
                model: pilot.vehicle.model,
                colour: pilot.vehicle.colour,
                vehicleType: pilot.vehicle.vehicleTypeBD.name,
                pilotRating: data?.activeBooking?.pilotRating?.rating || 0,
              }
            : null,
          passenger: {
            passengerId: data.userId,
            name: data.name,
            phone: data.phone,
            rating: data.averageRating,
          },
          pickupInMinutes: null,
          pickupLocation: data.activeBooking.pickupLocation,
          dropLocation: data.activeBooking.dropLocation,
          fairDetails: {
            originalFare: Math.ceil(Number(data.activeBooking.estimatedFare)),
            discountedFare: Math.ceil(
              Number(data.activeBooking.discountedFare),
            ),
            coupon: data.coupon,
          },
          otherPassengerInfo:
            data.activeBooking.rideType === RideType.OTHERS
              ? { name: data.activeBooking.name }
              : null,
        };

        data.activeBooking = payload;
      } else {
        data.activeBooking = null;
      }

      const { user: nestedUser, ...customerData } = data;
      customerData.status = nestedUser.status;

      return {
        message: 'Customer fetched successfully.',
        data: customerData,
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
      if (customer.isOnboardingCompleted) {
        throw new BadRequestException('Customer already Onboarded.');
      }

      const data = await this.prisma.customer.update({
        where: { userId: user.id },
        data: {
          name,
          email,
          isOnboardingCompleted: true,
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

  async updatePhone(userId: string) {
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
      await this.redis.set(`otp:${userId}`, otp, 300);

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
      const storedOtp = await this.redis.get(`otp:${userId}`);

      if (!storedOtp || storedOtp !== otp) {
        throw new UnauthorizedException('Invalid or expired OTP.');
      }
      const cachedOtp: any = await this.redis.del(`otp:${userId}`);
      if (!cachedOtp) {
        throw new UnauthorizedException('Invalid or expired OTP.');
      }

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

  async getVehicleCategories(
    vehicleCategoryDto: VehicleCategoryDto,
    userId: string,
  ) {
    const { pickupLocation, dropLocation } = vehicleCategoryDto;

    try {
      const customer: any = await this.prisma.customer.findUnique({
        where: {
          userId,
        },
        include: {
          coupon: true,
        },
      });
      if (!customer) {
        throw new NotFoundException('Customer not found.');
      }

      const vehicleTypes = await this.prisma.vehicleTypeBD.findMany({
        orderBy: {
          serialNumber: 'asc',
        },
      });

      // Use centralized fare calculation for all vehicle types
      const vehicles = await this.fareService.calculateMultipleVehicleFares({
        pickupLocation,
        dropLocation,
        vehicleTypes: vehicleTypes.map((vt) => ({
          id: vt.id,
          name: vt.name as VehicleTypeNameBD,
          airCondition: vt.airCondition,
          isFaster: vt.isFaster,
          passengerCapacity: vt.passengerCapacity,
        })),
        customerCoupon: customer.coupon,
        intercity: false,
      });

      // Increment demand (keep existing telemetry logic)
      const h3 = h3Cell(pickupLocation.lat, pickupLocation.lng, 8);
      await this.telemetry.incrementDemand(h3);

      if (customer.coupon) {
        customer.coupon.discount = customer.coupon.discount
          ? Number(customer.coupon.discount)
          : 0.0;
      }

      return {
        success: true,
        message: 'Vehicle categories fetched successfully.',
        data: { vehicles, coupon: customer.coupon || null },
      };
    } catch (error) {
      console.error(error);
      throw error;
    }
  }

  private async validateOtp(phone: string, otp: string) {
    const request_id = await this.redis.get(`requestId:${phone}`);

    const isVerified = await this.otpService.verifyOTP(phone, otp, request_id);
    if (!isVerified) {
      throw new UnauthorizedException('Invalid or expired OTP.');
    }

    const languageId = await this.redis.get(`languageId:${phone}`);
    const referralCode = await this.redis.get(`referralCode:${phone}`);

    await this.redis.del(`languageId:${phone}`);
    await this.redis.del(`referralCode:${phone}`);

    return { languageId, referralCode };
  }

  private async estimateTimeAwayForType(
    nearbyPilots: any[],
    vtId: string,
    pickup: { lat: number; lng: number },
  ) {
    for (const [pilotUserId, _distance] of nearbyPilots as any) {
      const pilot = await this.prisma.pilot.findFirst({
        where: {
          userId: pilotUserId,
          onlineStatus: PilotStatus.AVAILABLE,
          activeBookingId: null,
        },
        select: {
          vehicle: { select: { vehicleTypeBD: { select: { id: true } } } },
        },
      });

      if (pilot?.vehicle?.vehicleTypeBD?.id === vtId) {
        const pos = await this.redis.geoPos(
          RedisKeys.PILOT_LOCATION,
          pilotUserId,
        );
        if (pos && pos[0] && pos[1]) {
          const { durationMin } =
            await this.fareService.calculateDistanceAndDuration(
              { lat: pos[0], lng: pos[1] },
              pickup,
            );
          return Math.ceil(durationMin);
        }
        return undefined;
      }
    }
    return undefined;
  }
}
