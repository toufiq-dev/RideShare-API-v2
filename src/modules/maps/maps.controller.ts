import { Controller, Get, HttpCode, HttpStatus, Query } from '@nestjs/common';
import { MapsService } from './maps.service';
import { ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { DirectionsDto } from './dto/directions.dto';
import { PlaceDetailsDto } from './dto/place-details.dto';
import { AutocompleteDto } from './dto/autocomplete.dto';
import { ReverseGeocodingDto } from './dto/geocoding.dto';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { UseGuards } from '@nestjs/common';

@Controller('maps')
@UseGuards(JwtAuthGuard)
export class MapsController {
  constructor(private readonly mapsService: MapsService) {}

  @Get('directions')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get directions between two locations' })
  async getDirections(@Query() directionsDto: DirectionsDto) {
    return this.mapsService.getDirections(directionsDto);
  }

  @Get('geocode/reverse')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Reverse geocoding - convert coordinates to address',
  })
  async reverseGeocode(@Query() geocodingDto: ReverseGeocodingDto) {
    return this.mapsService.reverseGeocode(geocodingDto);
  }

  @Get('places/autocomplete')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get place autocomplete suggestions' })
  async getAutocomplete(@Query() autocompleteDto: AutocompleteDto) {
    return this.mapsService.getAutocomplete(autocompleteDto);
  }

  @Get('places/details')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get place details by place ID' })
  async getPlaceDetails(@Query() placeDetailsDto: PlaceDetailsDto) {
    return this.mapsService.getPlaceDetails(placeDetailsDto);
  }
}
