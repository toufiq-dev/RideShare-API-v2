# `src/modules/ride/services/ride-notification.service.ts`

## Role

**Real-time + push** for rides: uses Socket.IO `server` from `SocketService` to emit `RideEvents` to user rooms; uses `FirebaseService` for FCM with per-event payloads and sounds; reads `DeviceToken` from Prisma.

## Class: `RideNotificationService`

| Method | Description |
|--------|-------------|
| `sendPushNotification(userId, ...)` | Private: loads FCM token; sends via Firebase. |
| `notifyRideRequest` | Marks pilot notified in Redis TTL; push + `RIDE_REQUEST` socket. |
| `notifyRideCancelled` | Push + `RIDE_CANCELLED` to recipient. |
| `notifyDriverNotFound` | Delayed push + `DRIVER_NOT_FOUND` to customer. |
| `notifyRideRequestTimeout` | `RIDE_REQUEST_TIMEOUT` to pilot. |
| `notifyRideStatusUpdate` | Push + `RIDE_STATUS_UPDATE` for status changes. |
| `notifyReachedPickupPoint` | Push + `REACHED_PICKUP_POINT`. |
| `notifyDriverLiveLocation` | Socket-only `DRIVER_LIVE_LOCATION` (live map). |
| `notifyDriverForEditLocation` | Push + `RIDE_EDIT_LOCATION`. |
| `notifyLowBalance` | Pilot wallet nudge. |
| `notifyError` | `ERROR` event to user room. |
