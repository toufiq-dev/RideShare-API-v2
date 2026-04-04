# `src/modules/ride/services/driver-search.service.ts`

## Role

**Multi-iteration driver matching**: expands search radius over time, notifies pilots via `RideNotificationService`, tracks sessions in Redis, subscribes to booking status pub/sub, enforces global search timeout, and coordinates with GEO queries to find available pilots.

## Class: `DriverSearchService`

| Member | Description |
|--------|-------------|
| `DEFAULT_SEARCH_CONFIG` | Iteration count, radius, timeouts, max notifications per driver. |
| `searchDrivers(payload)` | Main entry: creates session, subscribes to `booking:{id}:status`, runs `executeMultiIterationSearch`, cleans up on completion or timeout. |
| Internal helpers | Session creation, iteration loops, radius expansion, notify pilots, handle timeout / driver not found, Redis keys under `RedisKeys.SEARCH_*`, metrics via `MetricsService` (if wired). |

## Interfaces (file-local)

- `SearchIteration`, `DriverSearchSession`, `SearchConfiguration` — describe in-memory + Redis session state.

## Notes

- File is large (~1000 lines); read source for exact Redis key patterns and iteration logic.
