# `src/common/interceptors/http-logging.interceptor.ts`

## Role

**HTTP request logging** interceptor. Logs incoming method/URL; on success/failure records duration, status, `requestId`, `userId`, IP, user-agent via `LoggerService.logHttp`; warns on slow requests (>1s).

## Class: `HttpLoggingInterceptor`

| Method | Description |
|--------|-------------|
| `intercept(context, next)` | Uses `tap`/`catchError` on observable pipeline; reads `getRequestContext()` for correlation ID. |
