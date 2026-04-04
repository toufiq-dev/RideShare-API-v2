# `src/common/filters/exception.filter.ts`

## Role

**Global exception filter** (`@Catch()`). Normalizes all thrown errors into a JSON body with `success: false`, user-facing `message`, and structured `error` (code, path, timestamp, `requestId`). Handles Prisma `P2002` (unique constraint) specially; logs stack traces for generic `Error`; increments Prometheus `httpRequestErrors` with sanitized route labels.

## Class: `GlobalExceptionFilter`

| Method | Description |
|--------|-------------|
| `constructor(logger, metrics)` | Injects `LoggerService` and `MetricsService`. |
| `catch(exception, host)` | Resolves HTTP `Request`/`Response`; classifies Prisma / `HttpException` / `Error` / unknown; builds `finalMessage`; logs via `logger.error`; calls `metrics.httpRequestErrors.inc(...)`; responds with JSON envelope. |
| `sanitizeRoute(route)` | Replaces UUIDs and numeric path segments with `/:id` and strips query string for metric cardinality. |

## Response shape

```json
{
  "success": false,
  "message": "...",
  "error": {
    "code": 400,
    "message": "...",
    "path": "/...",
    "timestamp": "ISO8601",
    "requestId": "..."
  }
}
```
