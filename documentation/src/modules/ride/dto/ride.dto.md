# `src/modules/ride/dto/ride.dto.ts`

## Role

**class-validator** DTOs for ride HTTP bodies: create/update/cancel/rate/start/end rides.

## Contents (typical)

Includes classes such as `CreateRideRequestDto`, `RideRequestAgainDto`, `BookingIdDto`, `StartRideDto`, `CancelRideRequestDto`, `EditRideRequestDto`, `RatingRideDto` — with `ApiProperty` for Swagger, coordinates, vehicle type ids, booking codes, cancellation reasons, etc.

## Notes

- See source for exact fields; many reference `LocationDto` patterns or Prisma enums (`BookingStatus`, `CancelledBy`).
