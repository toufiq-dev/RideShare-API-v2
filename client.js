const io = require('socket.io-client');

// Parse command line arguments
const args = process.argv.slice(2);
const url = 'http://localhost:3000/socket';
const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJjYzVlMzIyYi03ZjIzLTQ0NmYtYThiMi0yOWFlNzUxODhlMGIiLCJyb2xlIjoiQ1VTVE9NRVIiLCJpYXQiOjE3NDQxODI4ODksImV4cCI6MTc0NDI2OTI4OX0.HIW0EQMDlk_CONyQw5Wqu3D1b6yxc6FwWGWAFa4q62c'

console.log(`Connecting to: ${url}`);

const socket = io(url, {
  auth: {
    token,
  },
  reconnection: true,
  timeout: 10000,
});

// Connection events
socket.on('connect', () => {
  console.log('Connected to the server!');
  console.log('Socket ID:', socket.id);
});

socket.on('disconnect', (reason) => {
  console.log('Disconnected:', reason);
});

socket.on('connect_error', (error) => {
  console.error('Connection error:', error.message);
});

// Listen for all events
socket.onAny((event, ...args) => {
  console.log(`\n[${new Date().toISOString()}] Event: ${event}`);
  console.log('Data:', JSON.stringify(args, null, 2));
});

// Listen for specific events
const eventsToListen = ['rideRequest', 'rideAccepted', 'rideCancelled', 'error'];
eventsToListen.forEach(event => {
  socket.on(event, (data) => {
    console.log(`\n[${new Date().toISOString()}] Specific handler for: ${event}`);
    console.log('Data:', JSON.stringify(data, null, 2));
  });
});

console.log(`Listening for events: ${eventsToListen.join(', ')}`);
console.log('Press Ctrl+C to exit');