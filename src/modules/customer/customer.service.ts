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
  VehicleCategoryDto,
  CreateRideRequestDto,
} from './dto/customer.dto';
import { RedisService } from 'src/core/cache/redis.service';
import { OTPService } from 'src/core/utils/otp.util';
import { VerifyPhoneDto } from 'src/common/dto/common.dto';
import { FareService } from '../fare/fare.service';
import { VehicleTypeName, BookingStatus, RideType } from '@prisma/client';
import { RideService } from '../ride/ride.service';
import { CustomerRideResponse } from './interfaces/customer.interface';
import { CustomerRidePayload } from '../ride/dto/ride.interface';

@Injectable()
export class CustomerService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly otpService: OTPService,
    private readonly fareService: FareService,
    private readonly rideService: RideService,
  ) {}

  async getCustomer(userId: string) {
    try {
      const data: any = await this.prisma.customer.findUnique({
        where: {
          userId,
        },
        include: {
          coupon: true,
          language: true,
          activeBooking: true,
        },
      });

      if (!data) {
        throw new NotFoundException('Customer not found.');
      }

      if (data.activeBookingId) {
        const pilot = await this.prisma.pilot.findUnique({
          where: {
            id: data.activeBooking.pilotId,
          },
          select: {
            selfieUrl: true,
            phone: true,
            averageRating: true,
            currentLocation: true,
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
                vehicleType: {
                  select: {
                    name: true,
                  },
                },
              },
            },
          },
        });

        const payload: CustomerRidePayload = {
          bookingCode: data.activeBooking.bookingCode,
          bookingId: data.activeBooking.id,
          bookingStatus: data.activeBooking.status,
          estimatedDuration: data.activeBooking.estimatedDuration,
          pilot: {
            pilotName: pilot.drivingLicense.nameOnLicense,
            profilePicture: pilot.selfieUrl,
            pilotPhone: pilot.phone,
            rating: pilot.averageRating,
            pilotLocation: pilot.currentLocation,
            vehicleNumber: pilot.vehicle.regNo,
            model: pilot.vehicle.model,
            colour: pilot.vehicle.colour,
            vehicleType: pilot.vehicle.vehicleType.name,
          },
          pickupInMinutes: null,
          pickupLocation: data.activeBooking.pickupLocation,
          dropLocation: data.activeBooking.dropLocation,
          fairDetails: {
            origialFare: Number(data.activeBooking.estimatedFare),
            discountedFare: Number(data.activeBooking.discountedFare),
            coupon: data.coupon,
          },
          otherPassengerInfo:
            data.activeBooking.rideType === RideType.OTHERS
              ? { name: data.activeBooking.name }
              : null,
        };

        data.activeBooking = payload;
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
      await this.redis.del(`otp:${userId}`);

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

      const [vehicleTypesWithOther, distanceData] = await Promise.all([
        this.prisma.vehicleType.findMany(),
        this.fareService.calculateDistanceAndDuration(
          pickupLocation,
          dropLocation,
        ),
      ]);

      const { distanceKm, durationMin } = distanceData;

      const vehicleTypes = vehicleTypesWithOther.filter(
        (item: any) => item.name !== VehicleTypeName.OTHER,
      );

      const vehicleData = [];

      for (const item of vehicleTypes) {
        const originalPrice = this.fareService.estimateFare(
          distanceKm,
          durationMin,
          Number(item.baseFare),
          Number(item.perKmRate),
          Number(item.perMinRate),
        );

        const price =
          customer?.coupon?.discount && originalPrice > customer.coupon.discount
            ? originalPrice - Number(customer.coupon.discount)
            : originalPrice;

        const driversLocation = {
          lat: pickupLocation.lat,
          lng: pickupLocation.lng,
        };

        const { distanceKm: kmAway, durationMin: minsAway } =
          await this.fareService.calculateDistanceAndDuration(
            driversLocation,
            pickupLocation,
          );

        vehicleData.push({
          id: item.id,
          vehicleType: item.name,
          airCondition: item.airCondition,
          isFaster: item.isFaster,
          passengerCapacity: item.passengerCapacity,
          originalPrice: parseFloat(originalPrice.toFixed(0)),
          price: parseFloat(price.toFixed(0)),
          tolls: 0.0,
          timeAway: `${minsAway} min away`,
        });
      }

      if (customer.coupon) {
        customer.coupon.discount = customer.coupon.discount
          ? Number(customer.coupon.discount)
          : 0.0;
      }

      return {
        success: true,
        message: 'Vehicle categories fetched successfully.',
        data: {
          vehicles: vehicleData,
          coupon: customer.coupon || null,
        },
      };
    } catch (error) {
      console.error(error);
      throw error;
    }
  }

  async createRideRequest(
    createRideRequestDto: CreateRideRequestDto,
    userId: string,
  ) {
    const {
      vehicleTypeId,
      pickupLocation,
      dropLocation,
      currentLocation,
      rideFor,
      otherPassengerInfo,
    } = createRideRequestDto;

    try {
      // Fetch customer and vehicle type in one query
      const [customer, vehicleType] = await Promise.all([
        this.prisma.customer.findUnique({
          where: { userId },
          include: { coupon: true },
        }),
        this.prisma.vehicleType.findUnique({ where: { id: vehicleTypeId } }),
      ]);
      if (!customer) {
        throw new NotFoundException('Customer not found');
      }
      if (!vehicleType) {
        throw new NotFoundException('Vehicle type not found');
      }

      // Check active booking
      const activeBooking = await this.prisma.booking.findFirst({
        where: { customerId: customer.id, status: BookingStatus.PENDING },
      });
      if (activeBooking)
        throw new BadRequestException(
          'You already have an active ride request',
        );

      const origin = { lat: pickupLocation.lat, lng: pickupLocation.lng };
      const destination = { lat: dropLocation.lat, lng: dropLocation.lng };

      const { distanceKm, durationMin } =
        await this.fareService.calculateDistanceAndDuration(
          origin,
          destination,
        );

      const originalPrice = this.fareService.estimateFare(
        distanceKm,
        durationMin,
        Number(vehicleType.baseFare),
        Number(vehicleType.perKmRate),
        Number(vehicleType.perMinRate),
      );

      const coupon = customer.coupon;
      if (coupon && isNaN(Number(coupon.discount))) {
        throw new BadRequestException('Invalid coupon discount');
      }

      const price =
        coupon && originalPrice > Number(coupon.discount)
          ? originalPrice - Number(coupon.discount)
          : originalPrice;

      const booking = await this.prisma.booking.create({
        data: {
          bookingCode: randomInt(1000, 10000).toString(),
          customerId: customer.id,
          name:
            rideFor === RideType.SELF
              ? customer.name
              : otherPassengerInfo?.name,
          status: BookingStatus.PENDING,
          rideType: rideFor,
          estimatedFare: originalPrice,
          discountedFare: price,
          pickupLocation: JSON.parse(JSON.stringify(pickupLocation)),
          dropLocation: JSON.parse(JSON.stringify(dropLocation)),
          estimatedDistance: Math.ceil(distanceKm).toString(),
          estimatedDuration: Math.ceil(durationMin),
        },
      });

      await this.rideService.enqueueRideRequest({
        userId: customer.userId,
        bookingId: booking.id,
        estimatedFare: booking.estimatedFare,
        vehicleTypeId,
        distanceKm,
        durationMin,
        pickupLocation,
        dropLocation,
      });

      const data: CustomerRideResponse = {
        bookingId: booking.id,
        location: [pickupLocation, dropLocation],
        originalPrice: Number(originalPrice.toFixed(0)),
        discountedPrice: Number(price.toFixed(0)),
        coupon: coupon || null,
        otherPassengerInfo:
          booking.rideType === RideType.OTHERS
            ? { name: otherPassengerInfo.name }
            : null,
      };

      return {
        success: true,
        message:
          'Your ride request is being processed. Searching for a driver...',
        data,
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
    const refferalCode = await this.redis.get(`referralCode:${phone}`);

    await this.redis.del(`languageId:${phone}`);
    await this.redis.del(`referralCode:${phone}`);

    return { languageId, refferalCode };
  }
}
