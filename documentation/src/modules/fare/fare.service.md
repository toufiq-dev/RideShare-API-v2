# `src/modules/fare/fare.service.ts`

## Role

**Fare calculation** for Bangladesh vehicle types: uses Google Maps Directions (`@googlemaps/google-maps-services-js`) for distance/duration/polyline; applies `TariffService` + `MultiplierService` with H3 and city config (`pricing.city`, `MU_MIN`/`MU_MAX`); admin `updateFare` updates `VehicleTypeBD` base/per-km/per-min rates.

## Key methods

| Method | Description |
|--------|-------------|
| `updateFare` | Updates `prisma.vehicleTypeBD` by `VehicleTypeNameBD`. |
| `calculateDistanceAndDuration` | Directions API; returns km, minutes, polyline. |
| Further methods | Composite fare breakdown, surge, estimates — see source. |
