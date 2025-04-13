const io = require('socket.io-client');

const url = 'http://localhost:3000/socket';
const token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI1ZDI3NWIwYy0xNjhlLTRkMmQtYTQ5ZC02NjVhZWVkYTQ2MDUiLCJyb2xlIjoiQ1VTVE9NRVIiLCJpYXQiOjE3NDQ1NDY4MzYsImV4cCI6MTc0NDYzMzIzNn0.g1Jl9vgTGlk78uNWmWG7kmeDuXcd5B3zcnpKbWnAmTo"
console.log(`Customer connecting to: ${url}`);

const socket = io(url, {
  auth: { token },
  reconnection: true,
  timeout: 10000,
});

socket.on('connect', () => {
  console.log('Customer connected! Socket ID:', socket.id);
  // Send a test message after connecting
  setTimeout(() => {
    const message = {
      bookingId: 'b55ed126-4403-4a12-8700-4a10798af1b0',
      content: 'Hello, driver! When will you arrive?',
    };
    console.log('Customer sending message:', message);
    socket.emit('chat.sendMessage', message);
  }, 2000);
});

socket.on('chat.receiveMessage', (data) => {
  console.log(`[${new Date().toISOString()}] Customer received message:`);
  console.log(JSON.stringify(data, null, 2));
});

socket.on('error', (error) => {
  console.error('Customer error:', error);
});

socket.on('disconnect', (reason) => {
  console.log('Customer disconnected:', reason);
});

socket.on('connect_error', (error) => {
  console.error('Customer connect error:', error.message);
});