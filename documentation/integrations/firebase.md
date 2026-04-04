# Firebase (Cloud Messaging)

## Role in FairDrive

**`FirebaseService`** (`src/core/firebase/firebase.service.ts`): initializes **Firebase Admin SDK** and sends **FCM** messages (data-first payload) to device tokens stored in Prisma `DeviceToken`.

Used by **`RideNotificationService`** for ride requests, cancellations, status updates, etc.

## Environment variables

| Variable | Purpose |
|----------|---------|
| `FIREBASE_PROJECT_ID` | GCP project id |
| `FIREBASE_PRIVATE_KEY` | Service account private key (PEM; newlines often escaped as `\n` in env) |
| `FIREBASE_CLIENT_EMAIL` | Service account email |

Config path: `firebase.*` in `app.config.ts`.

## Sandbox vs production

- Use **separate Firebase projects** for dev/staging/prod (`fairdrive-dev`, `fairdrive-prod`) so test devices do not receive production pushes.
- Download a **new service account JSON** per project; map fields to the three env vars above.

## Dashboards and docs

- [Firebase Console](https://console.firebase.google.com/) — project settings, Cloud Messaging, service accounts.
- [FCM documentation](https://firebase.google.com/docs/cloud-messaging)

## Webhooks

FCM does not call your server for delivery by default. For analytics or troubleshooting, use Firebase Console and optional **BigQuery** export—not application webhooks.

## Operational notes

- Rotate service account keys if leaked; update env in all deployments.
- iOS/Android **APNs** / FCM setup (keys, certificates) is done in Firebase Console, not in this repo.
