# Surge / dynamic multiplier (μ) system

**Code:** `ArtifactsService`, `MultiplierService`, `TelemetryService`, `TariffService` (detour), `FareService` (composition). **Artifacts:** `artifacts/mu_zonehour.jsonl`, `artifacts/slab_betas.json`, optional `artifacts/detour_premium.json`. **Env:** `CITY`, `ARTIFACTS_DIR`, `MU_MIN`, `MU_MAX`, `DELTA_MAX`, `CAL_ALPHA`, `CAL_KAPPA`, `RHO_STAR`, `pricing.city` (Config).

## EMA-style update (cron every 5 minutes)

Per **H3 resolution 8** cell and **hour** (0–23) listed in `mu_zonehour.jsonl`:

```text
raw = ALPHA * prior + (1 - ALPHA) * prev + KAPPA * (D / S - RHO_STAR)
```

Then **optional neighbor smoothing** (H3 neighbors’ current μ for same hour):

```text
raw = 0.8 * raw + 0.2 * mean(neighbor μ)
```

Then **step limit** toward `raw` from `prev`:

- `next = stepLimit(raw, prev)` caps move per tick to **`DELTA_MAX`** (default **0.1**) up or down, then clamps to **[MU_MIN, MU_MAX]** (defaults **0.9** … **1.6**).

**Redis keys**

| Key | Meaning |
|-----|--------|
| `mu_prior:{city}:{h3}:{hour}` | Prior μ (loaded from JSONL at boot) |
| `mu:{city}:{h3}:{hour}` | Current μ (updated each tick) |
| `D:{city}:{h3}` | Demand counter |
| `S:{city}:{h3}` | Supply value |

**Defaults:** `ALPHA=0.6`, `KAPPA=0.15`, `RHO_STAR=1.0` (override with `CAL_ALPHA`, `CAL_KAPPA`, `RHO_STAR`).

## Where `mu_prior` comes from / how `mu_zonehour.jsonl` was generated

- **Runtime:** Each JSONL line `{ pickup_h3_r8, hour, mu_prior }` is loaded on startup into Redis (`mu_prior:*` and initial `mu:*`).  
- **Provenance:** `ArtifactsService` comment says **“from Colab”**; **no notebook or ETL script lives in this repo**, so the exact statistical definition of `mu_prior` (e.g. historical ratio, regression, smoothing) is **not documented in code**. Whoever produced the Colab export should describe the methodology.

## Demand (D) and supply (S)

| Signal | Redis | How updated |
|--------|-------|-------------|
| **D** | `D:{city}:{h3}` | `TelemetryService.incrementDemand` — **`INCRBY` with 15-minute TTL** (`incrbyWithExpire`). Called from **customer fare preview** (`customer.service` when vehicle categories / fares are requested). |
| **S** | `S:{city}:{h3}` | `TelemetryService.setSupply` — **plain `SET`** to a single integer. Called from **`beOnline`**: online → `setSupply(h3, 1)`, offline → `setSupply(h3, -1)` which becomes **`0`** after `Math.max(0, idleDrivers)`. |

So **D** is a **short-window count** of fare-preview events per cell; **S** is **not** a full idle-driver count—it is **0 or 1 per last write** for that pilot’s cell (last writer wins). The ratio **D/S** is therefore a **rough proxy**, not a calibrated marketplace depth metric.

## Distance slab β (`slab_betas.json`)

- **File shape:** array of `{ service_name, slab: "short"|"normal"|"long", beta }`.  
- **Loaded into memory** as per-service `{ short, normal, long }` (default 1).  
- **`MultiplierService.applyAdjustments`:** for trip distance **≤5 km** → `short`; **≤12 km** → `normal`; else → `long`; `mu *= beta`.  
- **Calibration:** betas in repo are near **1.0** (small tweaks). **How they were fitted** (offline model, regression, etc.) is **not** in this codebase—treat as **data science artifact** tied to whoever generated the JSON.

## Detour premium

- **Defaults in code:** `threshold: 1.25`, `premium: 1.0` (`ArtifactsService`).  
- **Override:** if `artifacts/detour_premium.json` exists, it replaces both.  
- With **premium = 1.0**, detour **never changes μ** (multiplier is a no-op); only the **threshold** matters for *would* apply. **`TariffService.computeDetourRatio`** supplies ratio for fares when route/straight-line is valid (1–3).

## Step limit `DELTA_MAX = 0.1`

- Each **5-minute** tick, μ can move **at most 0.1** toward the computed `raw` (before global min/max).  
- **Spike behavior:** Large gaps between `raw` and `prev` take **many ticks** to close (e.g. ~10+ ticks per 1.0 change). Whether that is **sufficient for high-demand events** is a **product/ops** call: it **dampens volatility** and avoids instant jumps; it **slows** response to sudden stress. Tune `DELTA_MAX`, tick cadence, or `KAPPA` if you need faster convergence.

## Reading μ in fares

- **`MultiplierService.getMu(city, h3, hour)`** uses current `mu:` key, else `mu_prior:`, else **1.0**.  
- **`FareService`** applies baseline × μ, then **`applyAdjustments`** (slab β, detour), then clamps to `[MU_MIN, MU_MAX]`.
