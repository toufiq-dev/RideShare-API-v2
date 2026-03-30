# `src/core/logging/winston.config.ts`

## Role

Builds **Winston `LoggerOptions`** from config: console (pretty in dev, JSON in prod), optional daily-rotating files (`logs/combined`, `error`, `http`), optional **Loki** transport in production for Grafana.

## Function

| Name | Description |
|------|-------------|
| `createWinstonConfig(configService): LoggerOptions` | Reads `app.environment`, `logging.level`, file/Loki toggles; assembles transports; sets default meta (`service`, `environment`, `version`); registers exception/rejection handlers to files + console. |
