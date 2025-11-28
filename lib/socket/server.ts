import { Server as SocketIOServer } from 'socket.io';
import { Server as HTTPServer } from 'http';
import { BalanceSnapshotSchema } from '@/lib/utils/balance-validation';
import { prisma } from '@/lib/db/prisma';
import { decimalToNumber } from '@/lib/utils/format';
// Use .js version to share cache with server.js price-refresh-service
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { fetchRLBPrice } = require('@/lib/utils/rlb-price-service.js');
import { sanitizePrice } from '@/lib/utils/price-validation';

let io: SocketIOServer | null = null;

export function initializeSocketIO(httpServer: HTTPServer) {
  if (io) {
    return io;
  }

  io = new SocketIOServer(httpServer, {
    path: '/api/socket.io',
    cors: {
      origin: '*',
      methods: ['GET', 'POST']
    },
    pingTimeout: 60000,
    pingInterval: 25000
  });

  io.on('connection', (socket) => {
    console.log(`[Socket.IO] Client connected: ${socket.id}`);

    // Handle ping/pong heartbeat
    socket.on('ping', () => {
      socket.emit('pong', { timestamp: new Date().toISOString() });
    });

    // Handle balance snapshot updates from external server
    socket.on('balance:update', async (data) => {
      try {
        // Validate the data
        const validated = BalanceSnapshotSchema.parse(data);

        // Parse timestamp or use current time
        const timestamp = validated.ts ? new Date(validated.ts) : new Date();

        // Fetch current RLB price (uses 55-second cache to respect rate limits)
        // This ensures each snapshot gets a reasonably current price
        const rawPrice = await fetchRLBPrice();

        // Validate and sanitize price (handles NULL, anomalies, etc.)
        const rlbPrice = sanitizePrice(rawPrice);

        // Log warning if price is null after sanitization
        if (rlbPrice === null) {
          console.warn('[Socket.IO] ⚠️  Creating snapshot without price - price fetch/validation failed');
        }

        // Save to database with current price
        const snapshot = await prisma.balanceSnapshot.create({
          data: {
            timestamp,
            pid: validated.pid || null,
            onchain_rlb: validated.onchain.rlb,
            onchain_usdt: validated.onchain.usdt,
            onsite_rlb: validated.onsite.rlb,
            onsite_usd: validated.onsite.usd,
            rlb_price_usd: rlbPrice,  // Attach validated price (may be null if all fetches failed)
          }
        });

        // Broadcast to all connected clients
        const snapshotData = {
          id: snapshot.id,
          ts: snapshot.timestamp.toISOString(),
          pid: snapshot.pid,
          onchain: {
            rlb: decimalToNumber(snapshot.onchain_rlb),
            usdt: decimalToNumber(snapshot.onchain_usdt)
          },
          onsite: {
            rlb: decimalToNumber(snapshot.onsite_rlb),
            usd: decimalToNumber(snapshot.onsite_usd)
          }
        };

        io?.emit('balance:snapshot', snapshotData);

        // Acknowledge to sender
        socket.emit('balance:ack', {
          success: true,
          id: snapshot.id,
          timestamp: snapshot.timestamp.toISOString()
        });

        console.log(`[Socket.IO] Balance snapshot saved and broadcasted: ${snapshot.id}`);
      } catch (error) {
        console.error('[Socket.IO] Error handling balance update:', error);
        socket.emit('balance:error', {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    });

    // Handle disconnect
    socket.on('disconnect', () => {
      console.log(`[Socket.IO] Client disconnected: ${socket.id}`);
    });

    // Send initial connection acknowledgment
    socket.emit('connected', {
      message: 'Connected to balance snapshot server',
      socketId: socket.id,
      timestamp: new Date().toISOString()
    });
  });

  return io;
}

export function getSocketIO(): SocketIOServer | null {
  return io;
}


