export const RideEvents = {
  UPDATE_PILOT_LOCATION: 'updateDriverLocation',
  DRIVER_LIVE_LOCATION: 'driverLiveLocation',
  RIDE_REQUEST: 'rideRequest',
  // RIDE_ACCEPTED: 'rideAccepted',
  // RIDE_STARTED: 'rideStarted',
  RIDE_STATUS_UPDATE: 'rideStatusUpdate',
  REACHED_PICKUP_POINT: 'reachedPickupPoint',
  RIDE_REQUEST_TIMEOUT: 'rideRequestTimeout',
  RIDE_CANCELLED: 'rideCancelled',
  DRIVER_NOT_FOUND: 'driverNotFound',
  ERROR: 'error',
} as const;

export const ChatEvents = {
  SEND_MESSAGE: 'rideSendMessage',
  MESSAGE_RECEIVED: 'rideReceiveMessage',
  TYPING: 'typing',
} as const;
