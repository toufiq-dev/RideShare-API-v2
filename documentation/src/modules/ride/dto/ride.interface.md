# `src/modules/ride/dto/ride.interface.ts`

## Role

**TypeScript interfaces** for payloads shared between services, Redis, and WebSocket layers (not necessarily validation DTOs).

## Typical exports

Interfaces such as `RideRequestPayload`, `NotifyDriverPayload`, `CustomerRidePayload`, `PilotRideResponse` — describe booking ids, locations, fare components, and status enums for driver search and notifications.

## Notes

- Use this file when tracing types across `RideService`, `DriverSearchService`, and `RideNotificationService`.
