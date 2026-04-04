# `src/common/types/express.d.ts`

## Role

**TypeScript augmentation** for Express types used in the project.

## Declarations

| Augmentation | Purpose |
|--------------|---------|
| `Express.Multer.File` | Adds optional `azureFileUrl` after Azure upload interceptor. |
| `Express.Request` | Adds optional `user` (JWT payload / any). |

## Notes

- Ensures `req.user` and `file.azureFileUrl` type-check in controllers and interceptors.
