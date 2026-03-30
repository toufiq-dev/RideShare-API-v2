# `src/common/middleware/error-logging.middleware.ts`

## Role

Logs **HTTP 4xx/5xx** responses when the response finishes (`res.on('finish')`), using `LoggerService.error` with method, URL, status, IP.

## Class: `ErrorLoggingMiddleware`

| Method | Description |
|--------|-------------|
| `use(req, res, next)` | Registers finish listener; if `statusCode >= 400`, logs a line; calls `next()`. |
