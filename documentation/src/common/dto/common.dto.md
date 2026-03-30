# `src/common/dto/common.dto.ts`

## Role

Shared **validation DTOs** used by multiple modules (e.g. auth location checks).

## Classes

| Class | Fields | Description |
|-------|--------|-------------|
| `VerifyPhoneDto` | `phone` (multi-country), optional `otp` (4 chars) | Phone verification payload; Swagger + class-validator. |
| `LocationDto` | `lat`, `lng` (bounded), optional `name`, `address` | Geographic point for service-area checks. |

## Validators

- `IsMultiCountryPhoneNumber` for `phone` fields (see `modules/auth/validator`).
