# `src/modules/pricing/tariff.service.ts`

## Role

Resolves **active Tariff** rows from Prisma by `city`, `VehicleTypeBD`, `intercity`, and effective date window; converts to a **baseline** numeric structure for fare math.

## Methods

| Method | Description |
|--------|-------------|
| `getActiveTariff(city, serviceName, intercity, when?)` | Finds latest active `Tariff` for vehicle type + city; throws if missing. |
| `toBaseline(t)` | Maps `Tariff` model to `{ baseFare, perKm, perMin, minFare, insuranceFee, pickupFee, pickupActive, version }`. |
| Other helpers | Additional pricing helpers in same file — see source. |
