export const RideEvents = {
  UPDATE_PILOT_LOCATION: 'updateDriverLocation', // for pilot
  DRIVER_LIVE_LOCATION: 'driverLiveLocation', // for customer
  RIDE_REQUEST: 'rideRequest', // for pilot
  RIDE_EDIT_LOCATION: 'rideEditLocation', // for pilot
  RIDE_STATUS_UPDATE: 'rideStatusUpdate', // for customer
  REACHED_PICKUP_POINT: 'reachedPickupPoint', // for customer
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
