# `src/core/metrics/metrics.service.ts`

## Role

**Prometheus metrics** using `prom-client`: default Node metrics plus HTTP histograms/counters, DB/Redis histograms, and business counters (rides, payments, pilot online, driver search).

## Class: `MetricsService`

### Registry

| Method | Description |
|--------|-------------|
| `onModuleInit()` | Initializes gauge defaults for connection types. |
| `getMetrics()` | Prometheus text exposition. |
| `getRegistry()` | Raw registry. |

### Recording helpers

| Method | Description |
|--------|-------------|
| `recordHttpRequest(method, route, statusCode, durationMs)` | Observes duration histogram, increments totals, counts 4xx/5xx as errors with sanitized route. |
| `recordDatabaseQuery(operation, table, durationMs, success)` | DB histogram. |
| `recordRedisOperation(operation, durationMs, success)` | Redis histogram. |
| `sanitizeRoute(route)` | Private: replaces UUIDs and numeric segments with `/:id` for label stability. |

### Public metric instances

Exposed as class properties: `httpRequestDuration`, `httpRequestTotal`, `httpRequestErrors`, `activeConnections`, `databaseQueryDuration`, `redisOperationDuration`, `rideBookings`, `rideCompletions`, `rideCancellations`, `pilotOnlineStatus`, `driverSearchDuration`, `paymentTransactions`, `businessMetrics` — used elsewhere for domain-specific increments.
