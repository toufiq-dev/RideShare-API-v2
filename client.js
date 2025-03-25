const io = require('socket.io-client');

// Configuration
const SOCKET_URL = 'http://localhost:3000/socket'; // Update with your server URL
const JWT_TOKEN = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI4MjEzZDg0ZC02M2E3LTQzNDYtYjY3NS01NTE1NmE3NTczODEiLCJyb2xlIjoiUElMT1QiLCJpYXQiOjE3NDI4ODkxNDEsImV4cCI6MTc0Mjk3NTU0MX0.VE1BNp0Tf8SL-huYqwVq-S0TaLtDJ7TJNqv4Znc3VYc";    // Replace with a valid pilot JWT token

// Predefined locations (Kolkata area)
const locations = [
  { lat: 22.5743533, lng: 88.3628733 },  // Base location
  { lat: 22.5745, lng: 88.3630 },        // Small variation 1 (~50m NE)
  { lat: 22.5742, lng: 88.3627 },        // Small variation 2 (~50m SW)
  { lat: 22.5739, lng: 88.3632 },        // Larger variation (~100m WSW)
  { lat: 22.5751, lng: 88.3625 }         // Larger variation (~100m ENE)
];

// Create socket connection
const socket = io(SOCKET_URL, {
  extraHeaders: {
    Authorization: `Bearer ${JWT_TOKEN}`
  }
});

// Socket event handlers
socket.on('connect', () => {
  console.log('Connected to server');
  startLocationUpdates();
});

socket.on('disconnect', () => {
  console.log('Disconnected from server');
});

socket.on('error', (error) => {
  console.error('Socket error:', error);
});

socket.on('connect_error', (err) => {
  console.error('Connection error:', err.message);
});

// Send location updates in sequence
function startLocationUpdates() {
  let index = 0;
  
  const interval = setInterval(() => {
    if (index >= locations.length) {
      clearInterval(interval);
      console.log('All test locations sent');
      socket.disconnect();
      return;
    }
    
    const location = locations[index];
    console.log(`Sending location ${index + 1}:`, location);
    socket.emit('updateLocation', location);
    index++;
  }, 3000); // Send every 3 seconds
}