# Infrastructure & deployment

Operational context for FairDrive API: **what is known from the repository and team handover**, versus what **must be recovered from Azure / DNS / whoever holds access**.

**Important:** This documentation does **not** contain secrets, connection strings, or SSH keys. Values live in GitHub Actions secrets, server `.env` files, and company credential stores.

## Document index

| Topic | File | Status |
|-------|------|--------|
| Azure VM, SSH, specs | [compute-and-access.md](compute-and-access.md) | Partial — no current Azure portal access |
| PostgreSQL | [database.md](database.md) | Filled from architecture decision + env pattern |
| DNS & TLS | [dns-and-tls.md](dns-and-tls.md) | Mostly TBD — fill when registrar/nginx owner confirms |
| Azure subscription / RG | [azure-subscription.md](azure-subscription.md) | TBD — no portal access |
| GitHub Actions secrets | [github-actions-secrets.md](github-actions-secrets.md) | Derived from `.github/workflows/*.yml` |
| Vendor register (audit / governance) | [third-party-services-register.md](third-party-services-register.md) | Env var **names** + TBD owner/plan; no secrets |

## Quick facts (for audits)

- **Compute:** API workloads run on an **Azure VM** (deploy user `azureuser`, app path `/home/azureuser/fairdrive-api` per CI scripts). **VM hostname, public IP, SKU, and disk** are **not** in this repo; former Azure admins or company machine SSH material hold the truth.
- **SSH:** Private key and access are on the **company machine** / whoever maintains `AZURE_SSH_KEY` in GitHub — not in git.
- **Database:** **Self-hosted PostgreSQL** on a **separate VM** (not Azure Database / RDS). **All deployed environments use the same database** as a deliberate (or historical) choice — see [database.md](database.md).
- **Reverse proxy:** Not defined in this repo; implied by public APIs (`docker-compose` binds `127.0.0.1` — see [compute-and-access.md](compute-and-access.md)).

## Related repo docs

- Docker production layout: `docker-compose.production.yml`
- Integrations (third-party keys): `documentation/integrations/`
- Env variable **names** (no values): `documentation/operations/environment-variables.template.md`
