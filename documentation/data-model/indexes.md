# Index documentation

Prisma / PostgreSQL: every `@id` and `@unique` field (or composite `@@unique`) creates an index. Below lists **explicit** `@@index` / `@@unique` from `schema.prisma` plus notes on common query paths.

## Explicit composite / secondary indexes

| Model | Definition | Typical use |
|-------|------------|-------------|
| `DeviceToken` | `@@index([fcmToken])` | Lookups by FCM token (broadcast / invalidation) |
| `SavedPlace` | `@@index([customerId])` | List saved places per customer |
| `VehicleClassificationCache` | `@@unique([class, manufacturer, model, bodyType, vehicleCategory, seatCapacity, permitType, isCommercial])` | Dedupe OpenAI / Signzy classification cache |
| `Tariff` | `@@index([city, intercity, vehicleTypeBDId, isActive])` | Resolve active tariff for fare engine |
| `PilotTrips` | `@@index([pilotId, date])` | Daily / range earnings aggregates per pilot |
| `Booking` | `@@index([customerId, status])` | Customer trip lists by status |
| `Booking` | `@@index([pilotId, status])` | Pilot trip lists by status |
| `Booking` | `@@index([tripStart])` | Time-range ride history / analytics |
| `Message` | `@@index([bookingId])` | Chat thread per booking |
| `PilotProgramEnrollment` | `@@unique([pilotId, programId])` | One enrollment row per pilot per program |
| `PilotRanking` | `@@unique([pilotId, rankingPeriod, calculatedAt, vehicleTypeId])` | Historical rank rows |
| `PilotRanking` | `@@index([rank])` | Top-N leaderboard slices |
| `PilotRanking` | `@@index([rankingPeriod, calculatedAt])` | Period + time filters |
| `PilotRanking` | `@@index([vehicleTypeId, rankingPeriod, calculatedAt, rank])` | Leaderboard by vehicle type |
| `PilotAchievement` | `@@unique([pilotId, achievementId])` | One unlock per pilot per achievement |
| `Translation` | `@@unique([languageId, key])` | i18n key per language |
| `VideoProgress` | `@@unique([pilotId, videoId])` | Progress row per pilot per tutorial |

## Single-column uniques (selection / joins)

Frequently used unique keys (not exhaustive):

- `User.email`, `Customer.phone`, `Customer.userId`, `Pilot.phone`, `Pilot.userId`
- `Coupon.name`, `PilotCoupon.name`, `Subscription.name`
- `Vehicle.regNo`, `DrivingLicense.licenseNumber`, `Booking` + ratings / cancellation `bookingId` uniques
- `SupportPermission.menuKey`, `Achievement.name`, `PilotProgram.name`, `Languages.name`

## Performance notes

1. **Foreign keys**: PostgreSQL does not create B-tree indexes on FK columns automatically. Prisma declares relations; if you filter heavily by a non-unique FK without an index, consider adding `@@index([fkColumn])` in a migration.
2. **JSON columns** (`Json` / `Json?`): no expression indexes in schema—avoid `WHERE json->>` without a supporting index at scale.
3. **Redis** is used for hot paths (pilot geo, booking status cache); DB indexes complement but do not replace that layer.
4. After adding `@@index` in Prisma, run `prisma migrate dev` (or equivalent) so the database stays in sync.
