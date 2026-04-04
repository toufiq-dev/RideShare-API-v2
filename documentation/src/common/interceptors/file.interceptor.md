# `src/common/interceptors/file.interceptor.ts`

## Role

**Multipart file upload** interceptor using Multer (disk storage), then uploads the file to **Azure Blob** via `AzureService.uploadFile`, attaches `azureFileUrl` to `request.file`, and deletes the temp file.

## Class: `CustomFileInterceptor`

| Method | Description |
|--------|-------------|
| `constructor(azureBlobService, configService)` | Loads allowed MIME types, max size, temp dir from `file.*` config; calls `initializeMulter()`. |
| `initializeMulter()` | Creates multer with disk storage, unique filenames (`fieldname-userId-timestamp.ext`), size limit, MIME filter. |
| `ensureTempDirectoryExists()` | `mkdir` temp dir if missing. |
| `cleanUpFile(path)` | Deletes temp file after upload or error. |
| `intercept(context, next)` | Runs multer pipeline; on success reads buffer, uploads to Azure, sets `file.azureFileUrl`, cleans temp, then `next.handle()`. |

## Errors

- `LIMIT_FILE_SIZE` → `BadRequestException` with size limit message.
- Rejected MIME → `BadRequestException` listing allowed types.
- Upload failure → `InternalServerErrorException`.
