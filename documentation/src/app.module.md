# `src/app.module.ts`

## Role

**Root Nest module.** Loads global configuration, JWT, BullMQ, database, Redis, logging, metrics, WebSockets, and every feature module. Registers `GlobalExceptionFilter` and `MainGateway`; exports `JwtModule` for injection elsewhere. Applies middleware for correlation IDs and error logging on all routes.

## Class: `AppModule`

| Member | Description |
|--------|-------------|
| `configure(consumer: MiddlewareConsumer)` | Applies `CorrelationIdMiddleware` and `ErrorLoggingMiddleware` to `*` (all routes). |

## Imports (modules)

| Module | Purpose |
|--------|---------|
| `ConfigModule.forRoot` | Global env config; loads `configuration` from `config/app.config.ts`. |
| `ScheduleModule` | Cron (`@nestjs/schedule`). |
| `JwtModule.registerAsync` | Global JWT using `getJwtConfig` + `ConfigService`. |
| `BullModule.forRootAsync` | Redis-backed BullMQ using `getBullConfig`. |
| `DatabaseModule` | Prisma + backup cron. |
| `RedisModule` | `RedisService`. |
| `LoggerModule` | Winston `LoggerService`. |
| `MetricsModule` | Prometheus metrics. |
| `SocketModule` | `SocketService`. |
| Feature modules | `Auth`, `Pilot`, `Languages`, `Subscriptions`, `Customer`, `Ride`, `Admin`, `Email`, `Payment`, `Fare`, `Geofencing`, `Chat`, `Firebase`, `Pricing`, `Health`, `Program`, `Maps`. |

## Providers

- `GlobalExceptionFilter` — registered at module level (also used globally in `main.ts` via filter registration pattern).
- `MainGateway` — WebSocket gateway for `/socket`.

## Exports

- `JwtModule` — so other modules can inject `JwtService` without re-importing configuration.
