import { Module } from '@nestjs/common';
import { BookingGateway } from './gateways/booking.gateway';
import { WebsocketController } from './websocket.controller';

@Module({
  providers: [BookingGateway],
  controllers: [WebsocketController],
  exports: [BookingGateway],
})
export class WebsocketModule {}
