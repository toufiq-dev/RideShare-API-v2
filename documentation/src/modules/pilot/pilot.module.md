# `src/modules/pilot/pilot.module.ts`

## Role

Registers **PilotController**, **PilotService**, and providers for verification, file upload, OTP, etc. (see module imports in source).

## Module: `PilotModule`

| Import | Purpose |
|--------|---------|
| `RideModule` | Pilot flows depend on ride exports. |
| `PricingModule` | Fare/tariff for pilot-side logic. |

| Provider | Notes |
|----------|--------|
| `PilotService` | Main pilot domain. |
| `AzureService` | Blob uploads (listed twice in source — likely redundant). |
| `ConfigService` | Explicit provider for utilities that expect injection. |
| `VerificationService` | KYC APIs + vision extraction. |
| `OTPService` | Phone OTP for phone change. |

**Exports:** `PilotService` only.
