import { Controller, UseGuards, Post, Body, HttpCode } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Roles } from 'src/common/decorators/roles.decorator';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { RoleEnum } from '../auth/dto/auth.dto';
import {
  CancelRideRequestDto,
  BookingIdDto,
  StartRideDto,
} from './dto/ride.dto';
import { ApiBearerAuth, ApiBody, ApiOperation } from '@nestjs/swagger';
import { CurrentUser } from 'src/common/decorators/user.decorator';
import { RideService } from './ride.service';

@ApiTags('Ride')
@Controller('ride')
@UseGuards(JwtAuthGuard, RolesGuard)
export class RideController {
  constructor(private readonly rideService: RideService) {}

  @Roles(RoleEnum.PILOT)
  @Post('accept')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Accept a ride' })
  async acceptRide(
    @Body() acceptRideDto: BookingIdDto,
    @CurrentUser('userId') userId: string,
  ) {
    return await this.rideService.acceptRide(acceptRideDto, userId);
  }

  @Roles(RoleEnum.PILOT)
  @Post('reached-pickup')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Reached the pick up point' })
  async reachedPickupPoint(
    @Body() reachedPickupPointDto: BookingIdDto,
    @CurrentUser('userId') userId: string,
  ) {
    return await this.rideService.reachedPickupPoint(
      reachedPickupPointDto,
      userId,
    );
  }

  @Roles(RoleEnum.PILOT)
  @Post('start')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Start the ride' })
  async startRide(
    @Body() startRideDto: StartRideDto,
    @CurrentUser('userId') userId: string,
  ) {
    return await this.rideService.startRide(startRideDto, userId);
  }

  @Roles(RoleEnum.PILOT)
  @Post('end')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'End the ride' })
  async endRide(
    @Body() endRideDto: BookingIdDto,
    @CurrentUser('userId') userId: string,
  ) {
    return await this.rideService.endRide(endRideDto, userId);
  }

  @Roles(RoleEnum.CUSTOMER, RoleEnum.PILOT)
  @Post('cancel')
  @HttpCode(200)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Cancel ride request' })
  @ApiBody({ type: CancelRideRequestDto })
  async cancelRideRequest(
    @Body() createRideRequestDto: CancelRideRequestDto,
    @CurrentUser('userId') userId: string,
  ) {
    return await this.rideService.cancelRideRequest(
      createRideRequestDto,
      userId,
    );
  }
}
