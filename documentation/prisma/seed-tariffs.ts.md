# `prisma/seed-tariffs.ts`

## Role

Seeds **Tariff** rows (and related `VehicleTypeBD` links if needed) from `artifacts/tariff_seed.json` or similar — establishes city/service/intercity pricing baselines.

## Notes

- Run after main seed or as part of deployment pipeline; align with `TariffService.getActiveTariff` expectations.
