const io = require('socket.io-client');

const url = 'http://localhost:3000/socket';
const token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJmYzA2NTkwYy00MDk5LTRhNzYtYjJkMC1jYjNlZDllMWZkZGQiLCJyb2xlIjoiUElMT1QiLCJpYXQiOjE3NDQ1NDU0MTYsImV4cCI6MTc0NDYzMTgxNn0.NVHq7GPpy3jZ_0aTVIMaxvFuh_x-Ufpus_EhD75nhU8"
console.log(`Driver connecting to: ${url}`);

const socket = io(url, {
  auth: { token },
  reconnection: true,
  timeout: 10000,
});

socket.on('connect', () => {
  console.log('Driver connected! Socket ID:', socket.id);
  // Respond to customer after 5 seconds
  setTimeout(() => {
    const message = {
      bookingId: 'b55ed126-4403-4a12-8700-4a10798af1b0',
      content: 'Hi! I’ll be there in 5 minutes.',
    };
    console.log('Driver sending message:', message);
    socket.emit('chat.sendMessage', message);
  }, 5000);
});

socket.on('chat.receiveMessage', (data) => {
  console.log(`[${new Date().toISOString()}] Driver received message:`);
  console.log(JSON.stringify(data, null, 2));
});

socket.on('error', (error) => {
  console.error('Driver error:', error);
});

socket.on('disconnect', (reason) => {
  console.log('Driver disconnected:', reason);
});

socket.on('connect_error', (error) => {
  console.error('Driver connect error:', error.message);
});