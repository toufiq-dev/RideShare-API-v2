# `src/common/interceptors/metrics.interceptor.ts`

## Role

**Prometheus HTTP metrics** interceptor. Records request duration and status via `MetricsService.recordHttpRequest` for every completed or errored request.

## Class: `MetricsInterceptor`

| Method | Description |
|--------|-------------|
| `intercept(context, next)` | Uses route `path` or raw URL; measures elapsed ms; calls `recordHttpRequest` in `tap` and `catchError`. |
