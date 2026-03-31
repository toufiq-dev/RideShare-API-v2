# Architecture

This section adds **diagrammatic** and **narrative** views that complement per-file docs under [`../src/`](../src/main.md).

| Doc | Purpose |
|-----|---------|
| [flows.md](flows.md) | Mermaid diagrams: auth, ride dispatch, payment |
| [../prisma/data-model.md](../prisma/data-model.md) | Core database entities and relationships |

## Stack (summary)

```mermaid
flowchart LR
  subgraph clients
    A[Mobile apps]
    B[Admin dashboard]
  end
  subgraph api[FairDrive API]
    HTTP[REST /api-docs]
    WS[WebSocket /socket]
  end
  subgraph data
    PG[(PostgreSQL)]
    RD[(Redis)]
  end
  subgraph obs[Observability]
    M[/metrics]
    L[Logs / Loki]
  end
  A --> HTTP
  A --> WS
  B --> HTTP
  HTTP --> PG
  HTTP --> RD
  WS --> RD
  api --> M
  api --> L
```

External vendors (maps, SMS, payments, KYC, push) are described in [`../integrations/`](../integrations/README.md).
