# DNS & SSL / TLS

## Domains (product context)

The codebase and CI reference hostnames such as:

- **`fairdrivebd.com`** (and subdomains, e.g. API v1/v2 — see `docker-compose.production.yml` comments, CORS in `main.ts`)
- **`fairdriveindia.com`** (CI environment URL: `https://api.fairdriveindia.com` in `.github/workflows/ci-cd.yml`)

## DNS provider / registrar

| Question | Status |
|----------|--------|
| Who is the **registrar** for `fairdrivebd.com`? | **Not recorded in this repository.** |
| Who is the **registrar** for `fairdriveindia.com`? | **Not recorded in this repository.** |
| DNS hosting (Cloudflare, Azure DNS, registrar DNS, etc.)? | **TBD** — confirm with whoever bought the domains or manages Azure. |

**Action for org:** Add a one-line entry: `Registrar: ___`, `DNS host: ___`, `Zone admin contact: ___`.

## SSL / TLS certificates

| Question | Status |
|----------|--------|
| Let's Encrypt (certbot) vs commercial CA vs Azure-managed? | **Not defined in this repo.** |
| Renewal process / expiry monitoring? | **TBD** |

Public HTTPS is almost certainly terminated **in front of** the Node apps (Nginx, Caddy, or Azure Application Gateway). **Certificate files and renewal jobs are not in this repository.**

**Action for org:** Document where certs live on the VM or LB and how they are renewed.

## WebSocket

Clients using **`/socket`** must use a TLS terminator and proxy that **supports WebSocket upgrade** (standard for Nginx with correct `map`/`proxy_set_header` settings). Exact config is **not** in this repo.
