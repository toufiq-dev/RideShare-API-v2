# `src/modules/pricing/multiplier.service.ts`

## Role

Computes **dynamic multipliers** (demand, time, H3 cell, etc.) applied on top of tariff baselines — uses `TelemetryService` and config bounds.

## Notes

- Read `MU_MIN`/`MU_MAX` usage in `FareService` / `CustomerService` for integration.
