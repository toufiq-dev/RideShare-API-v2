# `src/modules/ride/ride.service.ts`

## Role

**Ride domain orchestration**: create and re-request bookings, multi-stage driver dispatch (via `DriverSearchService`), pilot accept/start/end flows, pickup reached, cancellations, location updates (Redis GEO + cached booking status), fare settlement and wallet/program hooks, ratings, and history/trip lists.

## Key public methods

| Method | Description |
|--------|-------------|
| `handleUpdateLocation(client, lat, lng)` | Updates pilot position in Redis GEO; may update DB depending on flow. |
| `getActiveRideForPilot` | Reads Redis active ride for socket user, else DB. |
| `cacheBookingStatus` / `getBookingStatus` / `getCachedBookingStatus` | Redis vs Prisma booking status. |
| `getRideDetails(bookingId)` | Booking detail for customer/pilot views (includes fare breakdown, coupon). |
| `createRideRequest` | Validates customer, vehicle type, no duplicate active booking; persists booking; triggers `handleRideRequest` → driver search. |
| `rideRequestAgain` | Retry search for existing pending booking. |
| `handleRideRequest(payload)` | Entry from internal/dispatch pipeline. |
| `acceptRide` | Pilot accepts; validates status; updates booking, pilot, geo; notify customer. |
| `reachedPickupPoint` | Pilot marks arrival at pickup. |
| `startRide` | OTP/booking code validation; trip start. |
| `endRide` | Completes trip; fare reconciliation; wallet debits/credits; program ranking; **low balance** notification if applicable. |
| `cancelRideRequest` | Customer/pilot cancel; clears Redis; notifies counterpart; publishes booking status. |
| `editRideRequest` | Customer edits pickup/drop; recomputes fare; notifies pilot. |
| `ratingRide` | Pilot or customer rates after `COMPLETED`. |
| `getRideHistory` | Pilot paginated history with date range. |
| `getRideHistoryByBookingId` | Single trip detail for pilot. |
| `getMyTrips` | Customer trip list filtered by status. |

## Collaborators

`DriverSearchService`, `RideNotificationService`, `FareService` / pricing, `RedisService`, `PrismaService`, `FirebaseService` (indirect via notifications), `ProgramModule` services for rank.

## Notes

- Large file (~2.6k lines); business rules for coupons, wallet, and `BookingStatus` transitions are enforced here.
