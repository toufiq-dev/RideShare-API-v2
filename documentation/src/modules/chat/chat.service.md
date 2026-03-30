# `src/modules/chat/chat.service.ts`

## Role

**Ride-scoped chat**: persists `Message` rows tied to `bookingId`; only customer or pilot on that booking may send/read; allowed only when booking status is `ACCEPTED`, `ARRIVED`, or `ONGOING`.

## Methods

| Method | Description |
|--------|-------------|
| `sendMessage(userId, sendMessageDto)` | Validates booking + role; creates message; returns message + `recipientId` for gateway fan-out. |
| `getMessages(userId, bookingId, page, pageSize)` | Paginated history with total count. |

## Notes

- Real-time delivery is via `MainGateway` calling `sendMessage` on socket events.
