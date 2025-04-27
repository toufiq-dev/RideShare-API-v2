import {
  Controller,
  UseGuards,
  Post,
  Body,
  HttpCode,
  Patch,
  Param,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Roles } from 'src/common/decorators/roles.decorator';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { RoleEnum } from '../auth/dto/auth.dto';
import {
  CancelRideRequestDto,
  BookingIdDto,
  StartRideDto,
  EditRideRequestDto,
  CreateRideRequestDto,
  RatingRideDto,
} from './dto/ride.dto';
import { ApiBearerAuth, ApiBody, ApiOperation } from '@nestjs/swagger';
import { CurrentUser } from 'src/common/decorators/user.decorator';
import { RideService } from './ride.service';

@ApiTags('Ride')
@Controller('ride')
@UseGuards(JwtAuthGuard, RolesGuard)
export class RideController {
  constructor(private readonly rideService: RideService) {}

  @Roles(RoleEnum.CUSTOMER)
  @Post('request')
  @HttpCode(200)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create ride request' })
  @ApiBody({ type: CreateRideRequestDto })
  async createRideRequest(
    @Body() createRideRequestDto: CreateRideRequestDto,
    @CurrentUser('userId') userId: string,
  ) {
    return await this.rideService.createRideRequest(
      createRideRequestDto,
      userId,
    );
  }

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
    @Body() cancelRideRequestDto: CancelRideRequestDto,
    @CurrentUser('userId') userId: string,
  ) {
    return await this.rideService.cancelRideRequest(
      cancelRideRequestDto,
      userId,
    );
  }

  @Roles(RoleEnum.CUSTOMER)
  @Patch('edit/:bookingId')
  @HttpCode(200)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Edit ride request' })
  @ApiBody({ type: CancelRideRequestDto })
  async editRideRequest(
    @Param('bookingId') id: string,
    @Body() editRideRequestDto: EditRideRequestDto,
    @CurrentUser('userId') userId: string,
  ) {
    return await this.rideService.editRideRequest(
      id,
      editRideRequestDto,
      userId,
    );
  }

  @Roles(RoleEnum.PILOT, RoleEnum.CUSTOMER)
  @Post('rating')
  @HttpCode(200)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Rating a ride' })
  async ratingRide(
    @Body() ratingRideDto: RatingRideDto,
    @CurrentUser('userId') userId: string,
    @CurrentUser('role') role: RoleEnum,
  ) {
    return await this.rideService.ratingRide(ratingRideDto, userId, role);
  }
}
