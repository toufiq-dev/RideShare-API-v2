# `prisma/schema.prisma`

## Role

**Prisma schema** for PostgreSQL: defines models, relations, indexes, and enums. The Prisma Client (`@prisma/client`) is generated from this file.

## Related documentation

- **ER overview and model index:** [`data-model.md`](data-model.md) — high-level relationships and checklist of models.

## Major domains

| Domain | Examples |
|--------|----------|
| Users & auth | `User`, `DeviceToken`, `Admin`, `SuperAdmin`, `Support`, `SupportRole`, `SupportPermission` |
| Customers & pilots | `Customer`, `Pilot`, `DrivingLicense`, `Vehicle`, `PilotWallet`, bookings |
| Rides | `Booking`, `Message`, ratings, cancellation |
| Payments | `Transaction`, `Subscription`, coupons |
| Programs | Program-specific models (see full schema) |
| Config | `SystemConfig`, `Platform` (app versions) |

## Workflow

- Edit schema → `prisma migrate` (or `db push` in dev) → regenerate client.
- **Source of truth** for `UserRole`, `BookingStatus`, `VehicleTypeNameBD`, etc.

## Notes

- Datasource URL comes from environment; `prisma.config.ts` may apply in Prisma 7 setup.
