# `src/modules/ride/ride.module.ts`

## Role

Registers ride services, controller, and exports services for **AuthModule** and **MainGateway** (circular import pattern: `AuthModule` imports `RideModule`).

## Module: `RideModule`

| Import | Purpose |
|--------|---------|
| `FareModule` | Fare calculation and distance. |
| `FirebaseModule` | Push notifications (via notification service). |
| `ProgramModule` | Pilot program/ranking side effects. |

| Provider | Exported |
|----------|----------|
| `RideService` | Yes |
| `DriverSearchService` | Yes |
| `RideNotificationService` | Yes |

| Controller | `RideController` |
