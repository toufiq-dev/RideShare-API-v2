export const RedisKeys = {
  SOCKET_CONNECTION: 'socketConnection:',
  PILOT_LOCATION: 'pilotLocation',
  ACTIVE_RIDE: 'activeRide:',
  BOOKING_STATUS: 'bookingStatus:',
  NOTIFIED: 'notified-',
  RIDE_ACCEPTED: 'rideAccept:',
  // BOOKING_VEHICLE: 'bookingVehicle:',
  ACCESS_TOKEN: 'accessToken:',
  REFRESH_TOKEN: 'refreshToken:',
  EMAIL_VERIFICATION_OTP: 'emailVerificationotp:',

  // multi iteration search
  SEARCH_SESSION: 'searchSession:',
  ITERATION_STATUS: 'iterationStatus:',
  DRIVER_NOTIFICATION_COUNT: 'driverNotificationCount:',
  SEARCH_TIMEOUT: 'searchTimeout:',

  // Round-robin notification system
  DRIVER_ACTIVE_NOTIFICATION: 'driver-active-notification:',
} as const;
