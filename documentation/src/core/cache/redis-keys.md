# `src/core/cache/redis-keys.ts`

## Role

**Centralized Redis key prefixes** to avoid typos and document semantics.

## Export: `RedisKeys`

| Key | Purpose |
|-----|---------|
| `SOCKET_CONNECTION` | One active socket id per user (`socketConnection:{userId}`). |
| `PILOT_LOCATION` | Geospatial set name for pilot positions. |
| `ACTIVE_RIDE` | Active booking cache per pilot user id. |
| `BOOKING_STATUS` | Cached booking status string. |
| `NOTIFIED` | “Already notified pilot” markers for a booking. |
| `RIDE_ACCEPTED` | Acceptance tracking. |
| `ACCESS_TOKEN` / `REFRESH_TOKEN` | Session tokens per user. |
| `EMAIL_VERIFICATION_OTP` | Email OTP storage. |
| `SEARCH_SESSION`, `ITERATION_STATUS`, etc. | Multi-iteration driver search state. |
| `DRIVER_ACTIVE_NOTIFICATION` | Round-robin notification bookkeeping. |
