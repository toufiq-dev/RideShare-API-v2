# `src/core/utils/azure.util.ts`

## Role

**Azure Blob Storage** upload/delete and **Computer Vision Read API** OCR (async analyze + poll `operation-location`).

## Class: `AzureService`

| Method | Description |
|--------|-------------|
| `uploadFile(buffer, originalName, userId, contentType)` | Creates container if needed; uploads with content-type; returns blob URL. |
| `deleteFile(fileUrl)` | Parses URL path; deletes blob if exists. |
| `extractTextFromImage(imageBuffer)` | POST analyze; polls with exponential backoff until succeeded/failed/timeout. |

## Notes

- Container access set to `container` on create — review for public vs private requirements.
