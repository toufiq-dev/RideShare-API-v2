# `src/core/database/database.service.ts`

## Role

**Prisma ORM service** extending `PrismaClient` with PostgreSQL connection pool via `@prisma/adapter-pg`. Global database access for the application.

## Class: `PrismaService`

| Method | Description |
|--------|-------------|
| `constructor(configService)` | Builds `Pool` from `database.url`, wraps with `PrismaPg` adapter, passes logging config to `super()`. |
| `onModuleInit()` | `$connect()`; logs database URL on success. |
| `onModuleDestroy()` | `$disconnect()` and `pool.end()`. |

## Notes

- Query/error/info/warn events are emitted to Prisma’s event system (not shown in snippet beyond config).
- Import as `PrismaService` in modules (file name `database.service.ts`).
