# `src/modules/customer/customer.service.ts`

## Role

**Customer app** domain: profile with fare-related fields, saved places, phone change OTP, onboarding completion, vehicle category selection, **home** screen with fare estimates using `FareService`, `TariffService`, `MultiplierService`, `TelemetryService`, and H3 cells for pricing.

## Representative methods

| Method | Description |
|--------|-------------|
| `getCustomer` | Full profile, coupon, language, active booking. |
| `completeOnboarding` / `updateName` | Profile completion. |
| `updatePhone` / `verifyPhone` | Phone change with OTP. |
| `createSavedPlace` / `list` / `update` / `delete` | Saved addresses. |
| `getHome` | Estimates fares, applies multipliers; returns UI payload. |

## Dependencies

`PrismaService`, `RedisService`, `OTPService`, `FareService`, `TariffService`, `MultiplierService`, `TelemetryService`, `ConfigService`.
