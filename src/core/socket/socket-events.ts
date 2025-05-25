export const RideEvents = {
  UPDATE_PILOT_LOCATION: 'updateDriverLocation', // for pilot
  DRIVER_LIVE_LOCATION: 'driverLiveLocation', // for customer
  RIDE_REQUEST: 'rideRequest', // for pilot
  RIDE_EDIT_LOCATION: 'rideEditLocation', // for pilot
  RIDE_STATUS_UPDATE: 'rideStatusUpdate', // for customer
  REACHED_PICKUP_POINT: 'reachedPickupPoint', // for customer
  RIDE_REQUEST_TIMEOUT: 'rideRequestTimeout', // for pilot
  RIDE_CANCELLED: 'rideCancelled', // for both
  DRIVER_NOT_FOUND: 'driverNotFound', // for customer
  ERROR: 'error',
} as const;

export const ChatEvents = {
  SEND_MESSAGE: 'rideSendMessage',
  RECEIVE_MESSAGE: 'rideReceiveMessage',
  TYPING: 'typing',
  ERROR: 'error',
} as const;

export const Rooms = {
  forUser: (userId: string) => `user:${userId}`,
};
