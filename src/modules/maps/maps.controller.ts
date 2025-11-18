import { Controller, Get, HttpCode, HttpStatus, Query } from '@nestjs/common';
import { MapsService } from './maps.service';
import { ApiOperation } from '@nestjs/swagger';
import { DirectionsDto } from './dto/directions.dto';

@Controller('maps')
export class MapsController {
  constructor(private readonly mapsService: MapsService) {}

  @Get('directions')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get directions between two locations' })
  async getDirections(@Query() directionsDto: DirectionsDto) {
    return this.mapsService.getDirections(directionsDto);
  }
}
