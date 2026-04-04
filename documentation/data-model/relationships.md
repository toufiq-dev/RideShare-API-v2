# Relationship documentation

Derived from `prisma/schema.prisma`. **Cardinality** uses Prisma relation modifiers (`?` = optional / zero-or-one, array = one-to-many).

## Core patterns

### User hub

| From | To | Cardinality | FK field | Notes |
|------|-----|-------------|----------|--------|
| `User` | `Customer` | 1 : 0..1 | `Customer.userId` | Customer app profile |
| `User` | `Pilot` | 1 : 0..1 | `Pilot.userId` | Driver app profile |
| `User` | `Admin` / `SuperAdmin` / `Support` / `Promoter` | 1 : 0..1 | `*.userId` | Staff / promoter profiles |
| `User` | `DeviceToken` | 1 : 0..1 | `DeviceToken.userId` (PK) | FCM token row |

### Active booking (two named relations on `Booking`)

| Model | Field | Points to | Relation name |
|-------|--------|-----------|---------------|
| `Customer` | `activeBookingId` | `Booking.id` | `CustomerActiveBooking` |
| `Pilot` | `activeBookingId` | `Booking.id` | `PilotActiveBooking` |

At most one “current” booking per customer and per pilot when the product sets these fields; the same `Booking` can be linked from both sides during a trip.

### Pilot document graph

| Child | Parent | Delete rule |
|-------|--------|-------------|
| `DrivingLicense` | `Pilot` | `onDelete: Cascade` |
| `AdminDocumentSubmission` | `Pilot` | `onDelete: Cascade` |

Other 1:1 tables (`Nid`, `NumberPlate`, `TaxToken`, `Vehicle`) use `pilotId` as PK or unique FK without explicit cascade in schema—check migrations for DB-level behavior.

### Booking graph

- `Booking.customerId` → `Customer` (required).
- `Booking.pilotId` → `Pilot` (optional until accepted).
- `Booking.vehicleId` → `Vehicle` (optional; set when relevant).
- `Booking.vehicleTypeIdBD` → `VehicleTypeBD` (service category for the trip).
- `CancellationReason`, `CustomerRating`, `PilotRating`: at most one row per booking (`bookingId` unique).
- `Message`, `SupportTicket`: many rows per booking.

### Financial

- `PilotWallet.pilotId` → `Pilot` (1:1).
- `PilotWallet.subscriptionId` → `Subscription` (wallet tied to a subscription product).
- `Transaction.pilotId` → `Pilot`; optional `walletId` → `PilotWallet`; optional `subscriptionId` → `Subscription`.

### Programs

- `PilotProgramEnrollment`: composite unique `(pilotId, programId)`.
- `PilotRanking`: composite unique `(pilotId, rankingPeriod, calculatedAt, vehicleTypeId)` — supports history of leaderboard snapshots.

### Support

- `SupportTicket.userId` → `User` (reporter).
- `SupportTicket.bookingId` → `Booking`.
- `SupportTicket.supportId` → `Support` (assignee, optional).

### RBAC (support dashboard)

- `Support.supportRoleId` → `SupportRole`.
- `SupportRole` ↔ `SupportPermission`: implicit many-to-many (`SupportPermissionToSupportRole`).

## Enums (high level)

Enums are stored as PostgreSQL enum types (or text, depending on migration history). See `schema.prisma` for full lists: `UserRole`, `UserStatus`, `BookingStatus`, `PilotStatus`, `RideType`, `PilotType`, `ProgramType`, `TransactionType`, `TransactionStatus`, etc.
