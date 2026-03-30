# `src/main.ts`

## Role

Application **bootstrap**. Creates the NestJS HTTP application, wires cross-cutting concerns (logging, validation, errors, metrics, correlation IDs), enables CORS for FairDrive web and API hosts, registers Swagger UI, and listens on `0.0.0.0` using the configured port.

## Functions

| Function | Description |
|----------|-------------|
| `bootstrap()` | Async entrypoint: sets `TZ` to UTC; creates `AppModule` with buffered logs; resolves `LoggerService`, `MetricsService`, `ConfigService`; assigns Winston logger; installs `SocketIOAdapter` for WebSocket; applies `CorrelationIdMiddleware` at Express level; enables CORS allowlist; registers `GlobalExceptionFilter`, `TransformResponseInterceptor`, `HttpLoggingInterceptor`, `MetricsInterceptor`; global `ValidationPipe` with `whitelist`, `transform`, `forbidNonWhitelisted`; builds Swagger document and mounts it at `/api-docs`; listens on configured port and logs URLs for app, `/metrics`, and Swagger. |

## Dependencies (imports)

- `AppModule`, `ConfigService`, `ValidationPipe`, Swagger builders.
- `GlobalExceptionFilter`, `LoggerService`, `TransformResponseInterceptor`, `SocketIOAdapter`, `MetricsService`, `CorrelationIdMiddleware`, `HttpLoggingInterceptor`, `MetricsInterceptor`.

## Operational notes

- **Port:** From config key `app.port` (env `PORT`, default 3000).
- **Swagger:** Title “FairDrive API”, Bearer auth, tag “Auth”.
- **CORS:** Fixed list of `fairdrivebd.com` and related API/dashboard URLs; credentials enabled.
