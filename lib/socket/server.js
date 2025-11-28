const { Server: SocketIOServer } = require('socket.io');
const { BalanceSnapshotSchema } = require('../utils/balance-validation');
const { prisma } = require('../db/prisma');

let io = null;

function initializeSocketIO(httpServer) {
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
        pingInterval: 25000,
        connectTimeout: 60000, // 60 seconds connection timeout
        transports: ['websocket', 'polling'],
        allowEIO3: true // Allow Engine.IO v3 clients
    });

    // Log when Socket.IO engine is ready
    io.engine.on('connection_error', (err) => {
        console.error('[Socket.IO Engine] Connection error:', err);
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

                // Save to database
                const snapshot = await prisma.balanceSnapshot.create({
                    data: {
                        timestamp,
                        pid: validated.pid || null,
                        onchain_rlb: validated.onchain.rlb,
                        onchain_usdt: validated.onchain.usdt,
                        onsite_rlb: validated.onsite.rlb,
                        onsite_usd: validated.onsite.usd,
                    }
                });

                // Broadcast to all connected clients
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

function getSocketIO() {
    return io;
}

module.exports = { initializeSocketIO, getSocketIO };
