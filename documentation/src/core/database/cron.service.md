# `src/core/database/cron.service.ts`

## Role

**Scheduled database backup** using `@nestjs/schedule`. Triggers `DatabaseBackupService.createAndUploadBackup` daily at 3:00 AM Asia/Dhaka (cron `0 21 * * *` with `timeZone: 'Asia/Dhaka'` — 21:00 UTC aligns with 3 AM BST).

## Class: `BackupCronService`

| Method | Description |
|--------|-------------|
| `handleDailyBackup()` | Cron handler; logs start/success/failure. |
