# `src/modules/auth/auth.service.ts`

## Role

**Authentication and session lifecycle**: phone OTP for Bangladesh and India, Redis-backed OTP and session state, JWT access/refresh tokens stored in Redis, geofencing for location checks, pilot account lookup, logout (including socket teardown), account deletion, and public config endpoints (vehicle registration points, site settings).

## Public methods

| Method | Description |
|--------|-------------|
| `sendOtp(sendOtpDto)` | Resolves language; rate-limits OTP send; generates OTP; stores country/language/referral in Redis; validates promoter referral code; sends SMS via Khudebarta/SSL (BD) or MSG91 (IN); test numbers return fixed OTP `4242`. |
| `verifyOtp(verifyOtpDto)` | Validates OTP (Redis or MSG91); finds or creates customer/pilot user; applies referral rewards; upserts device token; returns JWT pair via `generateTokens`. |
| `checkLocation(locationDto, userId, role)` | Uses `GeofencingService.isWithinBoundary`; pilot-specific bypass for demo number. |
| `refreshToken(refreshTokenDto)` | Validates refresh token against Redis; issues new access/refresh via `generateTokens`. |
| `refreshFcmToken(dto, userId)` | Updates `DeviceToken` with new FCM token. |
| `findMyAccount(findPilotDto)` | Looks up pilot by phone for account recovery hints. |
| `deleteAccount(userId)` | Soft/hard delete flow per role; cleans related data. |
| `logout(userId)` | Clears Redis tokens; disconnects socket via `forceDisconnectUser`; pilot-specific cleanup. |
| `getVehicleRegistrationPoints()` | Returns registration point metadata for apps (from DB/config). |
| `getSiteSettings()` | Reads `SystemConfig` or similar for client-facing settings. |

## Private helpers

| Method | Description |
|--------|-------------|
| `validateOtpRedis` / `validateOtp` | BD/IN OTP verification paths. |
| `findOrCreateUser` | Registration path after OTP success. |
| `generateTokens` | Signs JWTs; stores access/refresh in Redis with TTL. |
| `validateStoredRefreshToken` | Refresh token parity check. |
| `forceDisconnectUser` | Finds Redis socket id; disconnects Socket.IO client. |
| `cleanupPilotData` | Pilot-specific cleanup on delete. |
| `normalizeReferral` | Normalizes referral code string. |

## Dependencies

`PrismaService`, `RedisService`, `JwtService`, `ConfigService`, `OTPService`, `GeofencingService`, `SocketService`.
