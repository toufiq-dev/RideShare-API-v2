# `src/core/logging/logger.service.ts`

## Role

Application **logger** extending `nest-winston` `WinstonLogger`, adding structured helpers for HTTP, business events, performance, and security.

## Class: `LoggerService`

| Method | Description |
|--------|-------------|
| `constructor(configService)` | Builds Winston logger via `createWinstonConfig`. |
| `log` / `error` / `warn` / `debug` / `verbose` | Delegates to Nest/Winston. |
| `logHttp(data)` | Structured HTTP log (method, url, statusCode, duration, requestId, userId, ip, userAgent). |
| `logError(error, context?, metadata?)` | Error with stack and extra fields. |
| `logBusinessEvent(event, metadata?)` | Prefixed `[BUSINESS_EVENT]`. |
| `logPerformance(operation, duration, metadata?)` | Prefixed `[PERFORMANCE]`. |
| `logSecurity(event, metadata?)` | Warn-level `[SECURITY]`. |
