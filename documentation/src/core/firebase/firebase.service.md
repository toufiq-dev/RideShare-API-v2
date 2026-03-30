# `src/core/firebase/firebase.service.ts`

## Role

Initializes **Firebase Admin** once and sends **FCM data-first** push notifications (Android high priority; APNS alert + sound).

## Class: `FirebaseService`

| Method | Description |
|--------|-------------|
| `constructor(configService)` | `initializeApp` with `credential.cert` from `firebase.projectId`, `privateKey` (normalized `\n`), `clientEmail`. |
| `sendNotification(token, title, body, data, sound?)` | Builds `Message` with `data` payload including title/body/sound; sends via `admin.messaging().send`. |

## Notes

- Commented block shows an alternate notification-first payload; current implementation favors `data` for client handling.
