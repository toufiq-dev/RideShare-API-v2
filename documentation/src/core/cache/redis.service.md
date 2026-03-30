# `src/core/cache/redis.service.ts`

## Role

**Redis façade** using ioredis: one command client plus dedicated **publisher** and **subscriber** for pub/sub. Implements token storage, GEO commands for driver locations, active-ride and booking-status caches, rate-style counters, and subscription helpers used by ride search and sockets.

## Class: `RedisService`

### Lifecycle

| Method | Description |
|--------|-------------|
| `constructor` | Creates three Redis clients with retry strategy; wires `setupEventListeners`. |
| `onModuleInit()` | `ping` all clients. |
| `onModuleDestroy()` | `quit` all clients. |

### Generic key/value

| Method | Description |
|--------|-------------|
| `getClient()` | Raw ioredis instance for advanced use (e.g. `SET NX`). |
| `pipeline()` | Redis pipeline. |
| `set(key, value, ttl?)` | `SET` with optional `EX` seconds. |
| `get(key)` | `GET`. |
| `del(key)` | `DEL`. |
| `exists(key)` | `EXISTS` as boolean. |
| `setnx(key, value, ttl?)` | Set if not exists. |
| `mget` / `mset` | Bulk get/set. |
| `mgetWithTTL(keys)` | Pipeline get + TTL per key. |
| `incr` / `incrby` / `incrWithExpire` / `incrbyWithExpire` | Counters with optional TTL. |
| `expire(key, ttl)` | Set TTL on existing key. |
| `keys(pattern)` | `KEYS` (use carefully in prod). |

### Geospatial (driver search)

| Method | Description |
|--------|-------------|
| `geoAdd(key, lat, lng, member)` | `GEOADD`; logs pilot phone from Prisma. |
| `geoPos(key, member)` | Returns `[lat, lng]` or null. |
| `geoRadius(...)` | `GEORADIUS` with optional WITHDIST, SORT, COUNT. |
| `zRem(key, member)` | Remove member from GEO sorted set. |

### Ride domain helpers

| Method | Description |
|--------|-------------|
| `setActiveRide` / `getActiveRide` / `removeActiveRide` | JSON payload `{ bookingId, customerUserId }` under `ACTIVE_RIDE` prefix. |
| `setBookingStatus` / `getBookingStatus` / `removeBookingStatus` | String status cache per booking. |

### Pub/sub

| Method | Description |
|--------|-------------|
| `subscribe` / `unsubscribe` | Subscriber client. |
| `publish` | Publisher client. |
| `onMessage` / `offMessage` | Attach/detach message handler on subscriber. |
