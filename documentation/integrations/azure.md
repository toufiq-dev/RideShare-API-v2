# Microsoft Azure (Blob, Vision, OpenAI, Communication Email)

## Role in FairDrive

| Service | Usage | Code |
|---------|--------|------|
| **Blob Storage** | User uploads, DB backup SQL files | `AzureService` (`azure.util.ts`), `DatabaseBackupService`, `CustomFileInterceptor` |
| **Computer Vision (Read OCR)** | Optional text extraction from images | `AzureService.extractTextFromImage` |
| **Azure OpenAI** | Vision + chat for Bangladesh document extraction, vehicle classification | `VerificationService` |
| **Communication Services — Email** | Transactional email (OTP) | `AzureEmailService` |

## Environment variables

### Storage

| Variable | Purpose |
|----------|---------|
| `AZURE_STORAGE_CONNECTION_STRING` | Blob connection string |
| `AZURE_STORAGE_CONTAINER_NAME` | Default uploads container (e.g. `uploaded-documents`) |
| `AZURE_STORAGE_CONTAINER_DB` | Database backup container |

### Computer Vision

| Variable | Purpose |
|----------|---------|
| `AZURE_COGNITIVE_SERVICES_ENDPOINT` | e.g. `https://<resource>.cognitiveservices.azure.com/` |
| `AZURE_COGNITIVE_SERVICES_API_KEY` | Vision API key |

### Azure OpenAI

| Variable | Purpose |
|----------|---------|
| `AZURE_OPENAI_ENDPOINT` | Azure OpenAI resource endpoint |
| `AZURE_OPENAI_KEY` | API key |
| `AZURE_MODEL_NAME` | Deployment name (e.g. `gpt-4o`) |
| `AZURE_API_VERSION` | REST API version (e.g. `2024-04-01-preview`) |

### Communication Services (Email)

| Variable | Purpose |
|----------|---------|
| `AZURE_COMMUNICATION_CONNECTION_STRING` | ACS connection string |
| `AZURE_COMMUNICATION_SENDER_ADDRESS` | Verified sender domain address |

### Standalone OpenAI (optional)

| Variable | Purpose |
|----------|---------|
| `OPENAI_API_KEY` | Non-Azure OpenAI key where used in code |

Config paths: `azure.*` and `openai.apiKey` in `app.config.ts`.

## Sandbox vs production

- **Separate resource groups** or subscriptions for dev vs prod.
- **Blob:** different storage accounts or at least different containers; never point dev builds at production backups.
- **Azure OpenAI:** separate deployments and keys per environment; quotas are per resource.
- **Communication Email:** verify **domains** per environment (Azure Communication domain verification).

## Dashboards and docs

- [Azure Portal](https://portal.azure.com/) — Storage accounts, Cognitive Services, OpenAI, Communication Services.
- [Azure Blob Storage docs](https://learn.microsoft.com/azure/storage/blobs/)
- [Azure OpenAI](https://learn.microsoft.com/azure/ai-services/openai/)
- [Azure Communication Email](https://learn.microsoft.com/azure/communication-services/concepts/email/email-overview)

## Webhooks

- **Blob:** Optional **Event Grid** subscriptions for blob created/deleted—not used in default FairDrive flows.
- **Communication Email:** Delivery status can use Event Grid webhooks if you implement them.

## Operational notes

- Connection strings and keys grant **full access** to the resource—store in Key Vault / secret manager, not in git.
- For OCR, monitor **transaction** limits on Cognitive Services.
- Loki logging (`LOKI_URL`) is separate infrastructure but often deployed alongside API in Azure or Kubernetes—see main README observability section.
