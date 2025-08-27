import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { FareService } from './fare.service';
import { ApiBody, ApiOperation } from '@nestjs/swagger';
import { UpdateFareDto } from './dto/fare.dto';

@Controller('fare')
export class FareController {
  constructor(private readonly fareService: FareService) {}

  @Post('update-fare')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update Fare' })
  @ApiBody({ type: UpdateFareDto })
  async updateFare(@Body() updateFareDto: UpdateFareDto) {
    return this.fareService.updateFare(updateFareDto);
  }
}
