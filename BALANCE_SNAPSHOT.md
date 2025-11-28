# Balance Snapshot System

This system allows you to save and track balance snapshots in real-time using both REST API and WebSocket (Socket.IO).

## Features

- **REST API**: Save balance snapshots via HTTP POST
- **WebSocket Server**: Real-time balance updates via Socket.IO
- **Ping/Pong Heartbeat**: Connection health monitoring
- **Database Storage**: All snapshots are saved to PostgreSQL
- **Real-time Broadcasting**: All connected clients receive updates instantly

## API Endpoints

### POST /api/balance/snapshot
Save a balance snapshot via REST API.

**Request Body:**
```json
{
  "ts": "2025-11-07T00:45:08.603Z",
  "pid": 1132978,
  "onchain": {
    "rlb": 100074.99978,
    "usdt": 7656.36
  },
  "onsite": {
    "rlb": 101132.407627,
    "usd": 7646.96
  }
}
```

**Response:**
```json
{
  "success": true,
  "message": "Balance snapshot saved successfully",
  "data": {
    "id": "uuid",
    "timestamp": "2025-11-07T00:45:08.603Z",
    "onchain": {
      "rlb": 100074.99978,
      "usdt": 7656.36
    },
    "onsite": {
      "rlb": 101132.407627,
      "usd": 7646.96
    }
  }
}
```

### GET /api/balance/snapshot
Get latest balance snapshots with pagination.

**Query Parameters:**
- `limit` (default: 100): Number of snapshots to return
- `offset` (default: 0): Pagination offset

## WebSocket (Socket.IO) Server

### Connection
Connect to: `ws://148.251.66.154:3000/api/socket.io`

### Events

#### Client → Server

**`balance:update`**
Send a balance snapshot update.

```javascript
socket.emit('balance:update', {
  ts: '2025-11-07T00:45:08.603Z',
  pid: 1132978,
  onchain: {
    rlb: 100074.99978,
    usdt: 7656.36
  },
  onsite: {
    rlb: 101132.407627,
    usd: 7646.96
  }
});
```

**`ping`**
Send a ping to check connection health.

```javascript
socket.emit('ping');
```

#### Server → Client

**`connected`**
Received when client connects.

```javascript
socket.on('connected', (data) => {
  console.log(data.message); // "Connected to balance snapshot server"
  console.log(data.socketId); // Socket ID
  console.log(data.timestamp); // ISO timestamp
});
```

**`balance:snapshot`**
Received when a new balance snapshot is saved (broadcasted to all clients).

```javascript
socket.on('balance:snapshot', (data) => {
  console.log('New snapshot:', data);
  // {
  //   id: "uuid",
  //   ts: "2025-11-07T00:45:08.603Z",
  //   pid: 1132978,
  //   onchain: { rlb: 100074.99978, usdt: 7656.36 },
  //   onsite: { rlb: 101132.407627, usd: 7646.96 }
  // }
});
```

**`balance:ack`**
Acknowledgment that your balance update was saved.

```javascript
socket.on('balance:ack', (data) => {
  console.log('Acknowledged:', data);
  // { success: true, id: "uuid", timestamp: "..." }
});
```

**`balance:error`**
Error occurred while processing balance update.

```javascript
socket.on('balance:error', (error) => {
  console.error('Error:', error);
  // { success: false, error: "error message" }
});
```

**`pong`**
Response to ping.

```javascript
socket.on('pong', (data) => {
  console.log('Pong received:', data.timestamp);
});
```

## Example Client Code

See `examples/balance-client.js` for a complete example.

### Quick Start

```javascript
const io = require('socket.io-client');

const socket = io('http://148.251.66.154:3000', {
  path: '/api/socket.io'
});

socket.on('connect', () => {
  console.log('Connected!');
  
  // Send balance update
  socket.emit('balance:update', {
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
  });
});

socket.on('balance:ack', (data) => {
  console.log('Balance saved:', data);
});

socket.on('balance:snapshot', (data) => {
  console.log('New snapshot received:', data);
});
```

## Database Migration

Run the migration to create the `BalanceSnapshot` table:

```bash
npm run db:migrate
```

## Heartbeat

The server automatically sends ping every 25 seconds. Clients can also send ping manually:

```javascript
// Send ping every 30 seconds
setInterval(() => {
  socket.emit('ping');
}, 30000);

socket.on('pong', (data) => {
  console.log('Server is alive:', data.timestamp);
});
```

## Notes

- All timestamps are in ISO 8601 format
- The `ts` field is optional - if not provided, current server time is used
- The `pid` field is optional
- All balance values must be non-negative numbers
- Snapshots are broadcasted to all connected clients in real-time


