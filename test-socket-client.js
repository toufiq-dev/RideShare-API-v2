const io = require('socket.io-client');

const socket = io('ws://localhost:3000', { transports: ['websocket'] });

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
