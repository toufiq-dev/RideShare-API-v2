# `src/modules/auth/auth.controller.ts`

## Role

REST **Auth** API (`@ApiTags('Auth')`, base path `auth`). Public OTP and token endpoints; JWT-protected location, logout, delete, FCM refresh.

## Routes

| Method | Path | Guards | Description |
|--------|------|--------|-------------|
| POST | `/auth/send-otp` | — | Send OTP SMS. |
| POST | `/auth/verify-otp` | — | Verify OTP and issue tokens. |
| POST | `/auth/location` | JWT + roles (CUSTOMER, PILOT) | Service-area check. |
| POST | `/auth/resend-otp` | — | Same as send-otp (rate limits apply in service). |
| POST | `/auth/refresh-token` | — | Rotate access token from refresh token. |
| POST | `/auth/refresh-fcm` | — | **Note:** uses `@CurrentUser` but no `@UseGuards` on method — verify if guard is missing in code. |
| POST | `/auth/find-pilot` | — | Find pilot account by phone. |
| POST | `/auth/delete-account` | JWT | Delete account. |
| POST | `/auth/logout` | JWT + roles | Logout and invalidate session. |
| GET | `/auth/vehicle-data` | — | Vehicle registration points. |
| GET | `/auth/site-settings` | — | Site settings. |

## Notes

- Swagger `@ApiBearerAuth` on protected routes.
- `Roles` decorator used with `RolesGuard` where specified.
