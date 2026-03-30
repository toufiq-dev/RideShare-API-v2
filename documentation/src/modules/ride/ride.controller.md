# `src/modules/ride/ride.controller.ts`

## Role

REST **Ride** API (`@Controller('ride')`). Most routes require JWT + `RolesGuard` with role-specific access.

## Routes

| Method | Path | Roles | Description |
|--------|------|-------|-------------|
| POST | `/ride/request` | CUSTOMER | Create booking. |
| POST | `/ride/request-again` | CUSTOMER | Retry search for existing request. |
| POST | `/ride/accept` | PILOT | Accept ride. |
| POST | `/ride/reached-pickup` | PILOT | Mark arrived at pickup. |
| POST | `/ride/start` | PILOT | Start trip (booking code). |
| POST | `/ride/end` | PILOT | End trip / complete fare. |
| POST | `/ride/cancel` | CUSTOMER, PILOT | Cancel ride. |
| PATCH | `/ride/edit/:bookingId` | CUSTOMER | Edit locations/fare. |
| POST | `/ride/rating` | PILOT, CUSTOMER | Submit rating. |
| GET | `/ride/history` | PILOT | Paginated history (`startDate`, `endDate`, `page`, `pageSize`). |
| GET | `/ride/history/:bookingId` | PILOT | Single booking detail. |
| GET | `/ride/trips` | CUSTOMER | Paginated trips by `status`. |
| GET | `/ride/:bookingId` | **Public** | Ride details (no auth in controller — review security if needed). |
