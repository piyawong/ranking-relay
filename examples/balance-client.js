/**
 * Example client code to connect to the balance snapshot Socket.IO server
 * 
 * Usage:
 *   const io = require('socket.io-client');
 *   const socket = io('http://148.251.66.154:3000', {
 *     path: '/api/socket.io'
 *   });
 * 
 *   // Send balance update
 *   socket.emit('balance:update', {
 *     ts: '2025-11-07T00:45:08.603Z',
 *     pid: 1132978,
 *     onchain: {
 *       rlb: 100074.99978,
 *       usdt: 7656.36
 *     },
 *     onsite: {
 *       rlb: 101132.407627,
 *       usd: 7646.96
 *     }
 *   });
 */

const io = require('socket.io-client');

// Connect to the server
const socket = io('http://148.251.66.154:3000', {
  path: '/api/socket.io',
  transports: ['websocket', 'polling']
});

// Connection event handlers
socket.on('connect', () => {
  console.log('✅ Connected to balance snapshot server');
  console.log('Socket ID:', socket.id);
});

socket.on('connected', (data) => {
  console.log('📨 Server message:', data.message);
  console.log('Socket ID:', data.socketId);
});

socket.on('disconnect', () => {
  console.log('❌ Disconnected from server');
});

socket.on('connect_error', (error) => {
  console.error('❌ Connection error:', error.message);
});

// Ping/Pong heartbeat
socket.on('pong', (data) => {
  console.log('🏓 Pong received:', data.timestamp);
});

// Send ping every 30 seconds
setInterval(() => {
  socket.emit('ping');
}, 30000);

// Balance update acknowledgment
socket.on('balance:ack', (data) => {
  console.log('✅ Balance snapshot acknowledged:', data);
});

socket.on('balance:error', (error) => {
  console.error('❌ Balance update error:', error);
});

// Listen for balance snapshots from other clients
socket.on('balance:snapshot', (data) => {
  console.log('📊 New balance snapshot received:', data);
});

// Example: Send a balance update
function sendBalanceUpdate(balanceData) {
  socket.emit('balance:update', balanceData);
}

// Example usage
if (require.main === module) {
  // Example balance data
  const exampleBalance = {
    ts: new Date().toISOString(),
    pid: process.pid,
    onchain: {
      rlb: 100074.99978,
      usdt: 7656.36
    },
    onsite: {
      rlb: 101132.407627,
      usd: 7646.96
    }
  };

  // Send update every 5 seconds (for testing)
  setInterval(() => {
    sendBalanceUpdate({
      ...exampleBalance,
      ts: new Date().toISOString()
    });
  }, 5000);
}

module.exports = { socket, sendBalanceUpdate };


