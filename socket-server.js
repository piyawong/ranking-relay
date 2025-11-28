const { createServer } = require('http');
const { Server: SocketIOServer } = require('socket.io');
const { BalanceSnapshotSchema } = require('./lib/utils/balance-validation');
const { prisma } = require('./lib/db/prisma');

const port = parseInt(process.env.SOCKET_PORT || '3001', 10);

// Create standalone HTTP server for Socket.IO
const httpServer = createServer();

// Initialize Socket.IO
const io = new SocketIOServer(httpServer, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  },
  pingTimeout: 60000,
  pingInterval: 25000,
  connectTimeout: 60000,
  transports: ['websocket', 'polling'],
  allowEIO3: true
});

io.on('connection', (socket) => {
  console.log(`[Socket.IO] Client connected: ${socket.id}`);

  // Handle ping/pong heartbeat
  socket.on('ping', () => {
    socket.emit('pong', { timestamp: new Date().toISOString() });
  });

  // Handle balance snapshot updates
  socket.on('balance:update', async (data) => {
    try {
      const validated = BalanceSnapshotSchema.parse(data);
      const timestamp = validated.ts ? new Date(validated.ts) : new Date();

      // Fetch current RLB price from API
      let rlbPrice = null;
      try {
        const response = await fetch('http://localhost:3000/api/balance/price');
        if (response.ok) {
          const priceData = await response.json();
          rlbPrice = priceData.data?.price_usd || null;
        }
      } catch (error) {
        console.error('[Socket.IO] Failed to fetch RLB price:', error);
        // Continue without price
      }

      const snapshot = await prisma.balanceSnapshot.create({
        data: {
          timestamp,
          pid: validated.pid || null,
          onchain_rlb: validated.onchain.rlb,
          onchain_usdt: validated.onchain.usdt,
          onsite_rlb: validated.onsite.rlb,
          onsite_usd: validated.onsite.usd,
          rlb_price_usd: rlbPrice,
        }
      });

      const snapshotData = {
        id: snapshot.id,
        ts: snapshot.timestamp.toISOString(),
        pid: snapshot.pid,
        onchain: {
          rlb: parseFloat(snapshot.onchain_rlb.toString()),
          usdt: parseFloat(snapshot.onchain_usdt.toString())
        },
        onsite: {
          rlb: parseFloat(snapshot.onsite_rlb.toString()),
          usd: parseFloat(snapshot.onsite_usd.toString())
        }
      };

      io.emit('balance:snapshot', snapshotData);

      socket.emit('balance:ack', {
        success: true,
        id: snapshot.id,
        timestamp: snapshot.timestamp.toISOString()
      });

      console.log(`[Socket.IO] Balance snapshot saved: ${snapshot.id}`);
    } catch (error) {
      console.error('[Socket.IO] Error:', error);
      socket.emit('balance:error', {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  socket.on('disconnect', () => {
    console.log(`[Socket.IO] Client disconnected: ${socket.id}`);
  });

  socket.emit('connected', {
    message: 'Connected to balance snapshot server',
    socketId: socket.id,
    timestamp: new Date().toISOString()
  });
});

httpServer.listen(port, '0.0.0.0', () => {
  console.log(`> Socket.IO server running on port ${port}`);
});


