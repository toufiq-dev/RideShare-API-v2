# `src/core/database/database.module.ts`

## Role

**Global** Nest module registering Prisma and backup-related services.

## Module: `DatabaseModule`

| Import | Purpose |
|--------|---------|
| `ScheduleModule.forRoot()` | Enables cron for backup scheduling. |

| Provider | Exports |
|----------|---------|
| `PrismaService` | Yes (global DB access) |
| `DatabaseBackupService` | No |
| `BackupCronService` | No |

## Notes

- `@Global()` — no need to import `DatabaseModule` in every feature module if Prisma is already available globally in your Nest setup; verify against `app.module` (imports `DatabaseModule` once).
