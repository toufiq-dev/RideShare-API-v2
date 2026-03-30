# `src/common/middleware/correlation-id.middleware.ts`

## Role

Assigns a **request ID** (`X-Request-ID` header or generated UUID), stores request context in **AsyncLocalStorage** for the duration of the request, and exposes `getRequestContext()` for loggers and filters.

## Class: `RequestContext`

| Member | Description |
|--------|-------------|
| `constructor(requestId, userId?, startTime?)` | Holds id, optional user id, start time. |
| `getDuration()` | Returns milliseconds since start. |

## Class: `CorrelationIdMiddleware`

| Method | Description |
|--------|-------------|
| `use(req, res, next)` | Reads `x-request-id` or `uuidv4()`; builds `RequestContext`; runs `asyncLocalStorage.run`; sets `req.requestId` / `req.requestContext`; sets response header `X-Request-ID`. |

## Function: `getRequestContext()`

Returns `RequestContext | undefined` from current async local storage store.
