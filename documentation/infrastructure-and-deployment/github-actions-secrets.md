# GitHub Actions — configured secrets

Derived from **`.github/workflows/ci-cd.yml`** and **`.github/workflows/production.yml`**.  
Actual values live in **GitHub → Repository → Settings → Secrets and variables → Actions**.

## Repository / registry

| Secret / token | Used for |
|----------------|----------|
| `GITHUB_TOKEN` | Supplied by GitHub Actions; Docker login to GHCR (`docker/login-action`) |

## Azure VM SSH deploy

| Secret | Purpose |
|--------|---------|
| `AZURE_HOST` | SSH target (VM hostname or IP) |
| `AZURE_USERNAME` | SSH user (workflows expect deploy flow compatible with `azureuser` on server) |
| `AZURE_SSH_KEY` | Private key PEM for SSH |
| `AZURE_SSH_PORT` | Optional; workflow uses `\|\| 22` if unset |

Used by: `appleboy/ssh-action` in **deploy** and **rollback** jobs (`ci-cd.yml`), and **production.yml** deploy job.

## Notifications

| Secret | Purpose |
|--------|---------|
| `SLACK_WEBHOOK_URL` | `8398a7/action-slack` — deployment status to channel `#deployments` (see workflow) |

## Not secrets but relevant

- **Environments** in GitHub: `production`, `staging` (referenced via `environment:` in workflow).
- **Images:** pushed to `ghcr.io` with tags derived from branch/sha and matrix (`india`, `v1`, `v2`, `dev`).

## What is *not* referenced as a GitHub secret in these workflows

Database URLs, JWT secrets, third-party API keys are **not** injected by these YAML files — they are expected on the **VM** in `.env*` / Docker `env_file`, not in GitHub (unless other workflows exist).

**Action for org:** Periodically audit **Actions secrets** and **environment protection rules** (who can deploy to `production`).
