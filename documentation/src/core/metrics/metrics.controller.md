# `src/core/metrics/metrics.controller.ts`

## Role

Exposes **Prometheus scrape endpoint** at `GET /metrics`.

## Class: `MetricsController`

| Route | Handler |
|-------|---------|
| `GET /metrics` | Returns `metricsService.getMetrics()` as plain text body (Prometheus format). |
