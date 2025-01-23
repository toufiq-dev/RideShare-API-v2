import { Body, Controller, Post } from '@nestjs/common';
import { BookingGateway } from './gateways/booking.gateway';

@Controller('websocket')
export class WebsocketController {
  constructor(private readonly bookingGateway: BookingGateway) {}

  @Post('ride-request')
  handleRideRequest(@Body() payload: any) {
    this.bookingGateway.handleRideRequest(payload);
  }

  @Post('ride-accept')
  handleRideAccepted(@Body() payload: any) {
    this.bookingGateway.handleRideAccepted(payload);
  }
}
