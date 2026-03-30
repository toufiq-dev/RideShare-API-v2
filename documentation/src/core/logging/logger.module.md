# `src/core/logging/logger.module.ts`

## Role

**Global** Winston integration and custom `LoggerService` provider.

## Module: `LoggerModule`

- Imports `WinstonModule.forRootAsync` with `createWinstonConfig`.
- **Providers:** `LoggerService`
- **Exports:** `LoggerService`, `WinstonModule`
