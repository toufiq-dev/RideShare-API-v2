# `src/core/database/backup.service.ts`

## Role

Creates **PostgreSQL dumps** with `pg_dump`, uploads to **Azure Blob Storage** (database container), deletes old `fairdrive-api_backup_*` blobs before upload, and cleans local `/tmp` files.

## Class: `DatabaseBackupService`

| Method | Description |
|--------|-------------|
| `constructor(configService)` | Loads Azure connection string, `azure.containerNameDb`, `database.url`; validates; builds `BlobServiceClient`. |
| `createAndUploadBackup()` | Timestamped `.sql` filename; `deletePreviousBackup`; runs `pg_dump`; `uploadToAzureBlob`; unlinks local file. |
| `deletePreviousBackup()` | Lists blobs with prefix `fairdrive-api_backup_`, deletes them (keeps storage tidy before new backup). |
| `uploadToAzureBlob(localPath, blobName)` | Ensures container exists; uploads file via block blob client. |

## Notes

- Requires `pg_dump` available in the runtime environment (e.g. Docker image).
- Debug logs reference `db.url` in one line — may be typo; primary URL is `database.url`.
