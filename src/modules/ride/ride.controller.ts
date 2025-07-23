import {
  Controller,
  UseGuards,
  Post,
  Get,
  Body,
  HttpCode,
  Patch,
  Param,
  Query,
  DefaultValuePipe,
  ParseIntPipe,
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
  RideRequestAgainDto,
} from './dto/ride.dto';
import { ApiBearerAuth, ApiBody, ApiOperation } from '@nestjs/swagger';
import { CurrentUser } from 'src/common/decorators/user.decorator';
import { RideService } from './ride.service';
import { BookingStatus } from '@prisma/client';

@ApiTags('Ride')
@Controller('ride')
export class RideController {
  constructor(private readonly rideService: RideService) {}

  @Roles(RoleEnum.CUSTOMER)
  @UseGuards(JwtAuthGuard, RolesGuard)
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

  @Roles(RoleEnum.CUSTOMER)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Post('request-again')
  @HttpCode(200)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create ride request again' })
  @ApiBody({ type: RideRequestAgainDto })
  async rideRequestAgain(
    @Body() rideRequestAgainDto: RideRequestAgainDto,
    @CurrentUser('userId') userId: string,
  ) {
    return await this.rideService.rideRequestAgain(rideRequestAgainDto, userId);
  }

  @Roles(RoleEnum.PILOT)
  @UseGuards(JwtAuthGuard, RolesGuard)
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
  @UseGuards(JwtAuthGuard, RolesGuard)
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
  @UseGuards(JwtAuthGuard, RolesGuard)
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
  @UseGuards(JwtAuthGuard, RolesGuard)
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
  @UseGuards(JwtAuthGuard, RolesGuard)
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
  @UseGuards(JwtAuthGuard, RolesGuard)
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
  @UseGuards(JwtAuthGuard, RolesGuard)
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

  @Roles(RoleEnum.PILOT)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Get('history')
  @HttpCode(200)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get ride history' })
  async getRideHistory(
    @CurrentUser('userId') userId: string,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('pageSize', new DefaultValuePipe(10), ParseIntPipe) pageSize: number,
  ) {
    return await this.rideService.getRideHistory(
      userId,
      startDate,
      endDate,
      page,
      pageSize,
    );
  }

  @Roles(RoleEnum.CUSTOMER)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Get('trips')
  @HttpCode(200)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get my trips' })
  async getMyTrips(
    @CurrentUser('userId') userId: string,
    @Query('status') status: BookingStatus,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('pageSize', new DefaultValuePipe(10), ParseIntPipe) pageSize: number,
  ) {
    return await this.rideService.getMyTrips(userId, status, page, pageSize);
  }

  @Get(':bookingId')
  @ApiOperation({ summary: 'Get ride details' })
  async getRideDetails(@Param('bookingId') bookingId: string) {
    console.log('**** rideDetails ****');
    return await this.rideService.getRideDetails(bookingId);
  }
}
