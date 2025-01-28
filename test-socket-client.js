const io = require('socket.io-client');

const socket = io('ws://20.197.44.230:3000', { transports: ['websocket'] });

socket.on('connect', () => {
  console.log('Connected to WebSocket server');
  socket.emit('message', 'Hello, server!');
});

socket.on('connection', (message) => {
  console.log(`Server: ${message}`);
});

socket.on('disconnect', () => {
  console.log('Disconnected from WebSocket server');
});

socket.on('booking-request', (data) => {
  console.log('Received booking request:', data);
});
