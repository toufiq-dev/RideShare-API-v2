# Azure VM — hostname, IP, specs, SSH

## What the repository proves

From **GitHub Actions** (`.github/workflows/ci-cd.yml`, `production.yml`):

| Item | Value / pattern |
|------|------------------|
| Deploy user | `azureuser` |
| App directory on VM | `/home/azureuser/fairdrive-api` |
| SSH authentication | Key-based via `appleboy/ssh-action` |
| Secrets used | `AZURE_HOST`, `AZURE_USERNAME`, `AZURE_SSH_KEY`, optional `AZURE_SSH_PORT` (default SSH 22) |

`AZURE_HOST` is typically the VM’s **public IP or DNS name** — the actual string is only in **GitHub → Settings → Secrets**.

Post-deploy health checks in CI hit **localhost** on the VM:

| Service | Port (on VM) |
|---------|----------------|
| India API | 3000 |
| V1 API | 3001 |
| V2 API | 3002 |
| Dev API | 8080 (development branch deploy path) |

## What is **not** in the repository (honest gap)

The following are **not** documented in git because **current developers no longer have Azure portal access** and **SSH private key material lives on the company machine** (or in GitHub Secrets only):

- Azure VM **resource name**
- **Public / private IP** (except that `AZURE_HOST` resolves to whatever ops configured)
- **SKU / vCPU / RAM / OS disk size**
- **Region**, **resource group**, **subscription ID** (see [azure-subscription.md](azure-subscription.md))

## SSH access method (for auditors)

1. **GitHub Actions:** CI/CD deploys using the **`AZURE_SSH_KEY`** secret (no key in repo).
2. **Humans:** Use the **same** key pair or a separate admin key stored **only** on approved company equipment — **not** committed to this repository.

**Action for org:** Whoever retains Azure access should paste **one paragraph** into this doc or the internal wiki: VM name, SKU, region, RG, and how engineers request SSH (ticket process).

## Nginx / reverse proxy (related)

`docker-compose.production.yml` publishes API ports on **`127.0.0.1`** only (e.g. `127.0.0.1:3001:3000`). That implies a **reverse proxy on the VM** (commonly Nginx or Azure LB) terminates TLS and routes `api.*` hostnames to those local ports. **Config is not in this repo** — document path/server with DevOps.
