# `src/modules/pilot/pilot.controller.ts`

## Role

REST API under `pilot` for driver app: KYC uploads, phone OTP, going online, vehicles, transactions, coupons, BD-specific document flows.

## Route map (representative)

| Prefix | Purpose |
|--------|---------|
| `GET /pilot` | Current pilot profile. |
| `POST /pilot/phone/otp`, `POST /pilot/phone/verify` | Change phone. |
| `POST /pilot/driving-license` (+ `/manual`) | India DL. |
| `POST /pilot/live-selfie` | Selfie upload. |
| `POST /pilot/vehicle-rc` (+ `/manual`) | India RC. |
| `POST /pilot/pancard` (+ `/manual`), `aadhaar` (+ `/manual`, `/verify`) | India ID. |
| `GET /pilot/onboarding-offer`, `POST /pilot/free-recharge` | Promotions. |
| `GET /pilot/vehicle/list`, `GET /pilot/transactions` | Data lists. |
| `POST /pilot/online` | Go online with location. |
| `POST /pilot/bd-*` | Bangladesh document flows (license, nid, rc, number-plate, tax-token) with confirmation endpoints. |
| `POST /pilot/details`, `GET /pilot/coupons` | Profile update and coupons. |

## Notes

- Most routes use `JwtAuthGuard` + `Roles(UserRole.PILOT)` and file interceptors for uploads — confirm per method in source.
