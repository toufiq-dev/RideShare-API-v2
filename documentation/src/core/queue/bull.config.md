# `src/core/queue/bull.config.ts`

## Role

**BullMQ root configuration** factory: Redis connection URL from config, default job options (remove on complete, retain failed, retries with exponential backoff).

## Function

| Name | Description |
|------|-------------|
| `getBullConfig(configService): QueueOptions` | Returns `{ connection: { url: redis.url }, defaultJobOptions: { removeOnComplete: true, removeOnFail: 1000, attempts: 3, backoff: exponential 1s } }`. |
