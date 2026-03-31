# Operations

Short runbook for running and observing FairDrive API. Pair with [`../integrations/`](../integrations/README.md) for vendor setup.

## Environment

1. Copy [`.env.example`](../../.env.example) to `.env` at the repo root.
2. Fill secrets via your team’s secret manager in production—**never** commit `.env`.
3. `src/config/app.config.ts` maps `process.env.*` to nested config keys consumed by services.

## Local development

- **Database:** PostgreSQL reachable from your machine; set `DATABASE_URL`.
- **Redis:** Required for sessions, GEO, Bull, token store.
- **Run API:** `pnpm install` then `pnpm run start:dev` (see root `package.json`).
- **Docker:** Use project `docker-compose.*.yml` if your team standardizes on it.

## Health and readiness

| Method | Path | Notes |
|--------|------|--------|
| GET | `/health` | Prisma + Redis (`HealthController.check`) |
| GET | `/health/detailed` | Adds memory + placeholder Azure storage check |

Use **`GET /health`** for Kubernetes/Docker **liveness/readiness** when only DB + Redis matter.

## Observability

| Signal | Where |
|--------|--------|
| HTTP / errors | Winston logs (`logs/` when file logging on), optional **Loki** (`LOKI_URL`, `ENABLE_LOKI`) |
| Metrics | `GET /metrics` (Prometheus format) |
| Tracing | Not wired in repo by default—add OpenTelemetry if needed |

## Database migrations

- Schema: `prisma/schema.prisma`
- Apply: `prisma migrate deploy` (production) or `prisma migrate dev` (development)
- Seeds: `pnpm seed` and scripts under `prisma/seed*.ts`

## Backups

- `DatabaseBackupService` can dump PostgreSQL and upload to Azure Blob (`AZURE_STORAGE_CONTAINER_DB`); scheduled via `BackupCronService`.
- Test restore in a non-production environment periodically.

## Incident checklist

1. Check application logs and Loki for error spikes.
2. Check `/metrics` and infrastructure (CPU, Redis memory, DB connections).
3. Verify third-party status (maps quota, payment gateway, SMS).
4. Roll back deployment or feature-flag risky paths per your process.
