# `src/modules/auth/dto/auth.dto.ts`

## Role

**Request validation** and Swagger models for auth flows.

## Enums / classes

| Symbol | Description |
|--------|-------------|
| `Country` (local enum) | `BD`, `IN` for optional country hints. |
| `UserRole` (local enum) | Mirrors app roles including `SUPER_ADMIN`, `ADMIN`, `CUSTOMER`, `PILOT`, `SUPPORT`, `PROMOTER` — **note:** Prisma `UserRole` should be the source of truth; keep in sync. |
| `SendOtpDto` | `language`, `phone` (multi-country), optional `referralCode`, optional `countryCode`. |
| `VerifyOtpDto` | `phone`, `otp` (4 chars), `role`, optional `fcmToken`. |
| `RefreshTokenDto` | `refreshToken` string. |
| `RefreshFcmTokenDto` | `fcmToken` string. |
| `FindPilotDto` | `phone` for account lookup. |

## Validators

- `IsMultiCountryPhoneNumber(['IN','BD'])` on phone fields.
