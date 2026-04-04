# Database — host, port, names, managed vs self-hosted

## Managed vs self-hosted

| Question | Answer |
|----------|--------|
| Is PostgreSQL **managed** (Azure Database for PostgreSQL, RDS, etc.)? | **No** — **self-hosted** PostgreSQL on a **dedicated VM**. |
| Install style | Default / standard PostgreSQL service on that host (not a cloud PaaS offering). |

## Same database across environments

**Team statement:** **All environments (e.g. development, production instances) point at the same PostgreSQL database** — i.e. a **single** `DATABASE_URL` target (same host, database name, schema) unless someone changes it on a given machine.

**Implications (for audits):**

- Simplifies ops but **increases blast radius**: schema migrations and bad data affect every line (India / V1 / V2 / dev) that shares that URL.
- **Recommendation for future:** split **at least** prod vs non-prod databases; keep this doc updated when that happens.

## Host, port, database name (pattern only — no secrets)

Environment files (e.g. local `.env.development`, server `.env.production`) set:

- **`DATABASE_URL`** — PostgreSQL connection URI.

From a **development** example (structure only, credentials redacted):

- **Host:** private network IP of the DB VM (e.g. `10.x.x.x` — RFC1918 space)
- **Port:** `5432` (PostgreSQL default)
- **Database name (example):** `fairdrivedb`
- **Schema:** `public` (typical `?schema=public` in URL)

**Do not** commit real URLs, passwords, or IPs in this markdown; copy from secret store when onboarding.

## Prisma

- Schema: `prisma/schema.prisma`
- Migrations: `prisma/migrations/`
- Apply in each environment that uses that database: `prisma migrate deploy` (or your approved process)

## Backups

Application can upload SQL dumps to Azure Blob (`DatabaseBackupService` + `AZURE_STORAGE_CONTAINER_DB`) — see `src/core/database/backup.service.ts`. Backup schedule and restore drills are **operational** procedures outside this file.
