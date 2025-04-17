import { Controller, UseGuards, Post, Body, HttpCode } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Roles } from 'src/common/decorators/roles.decorator';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { RoleEnum } from '../auth/dto/auth.dto';
import { CancelRideRequestDto } from './dto/ride.dto';
import { ApiBearerAuth, ApiBody, ApiOperation } from '@nestjs/swagger';
import { CurrentUser } from 'src/common/decorators/user.decorator';
import { RideService } from './ride.service';

@ApiTags('Ride')
@Controller('ride')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(RoleEnum.CUSTOMER, RoleEnum.PILOT)
export class RideController {
  constructor(private readonly rideService: RideService) {}

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
