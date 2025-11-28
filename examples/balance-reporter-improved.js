#!/usr/bin/env node

/**
 * Lightweight Balance Reporter Service
 * Reads balance state from file and sends to Socket.IO server
 * Non-blocking, minimal footprint
 */

import { readFile } from 'fs/promises';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const io = require('socket.io-client');

// Configuration
const STATE_FILE = '/root/rlb-arbitrage-bot/rebalance-state.json';
const SOCKET_URL = 'http://148.251.66.154:3001'; // Socket.IO on port 3001
const POLL_INTERVAL = 5000; // Check file every 5 seconds
const PING_INTERVAL = 25000; // Send ping every 25 seconds
const CONNECTION_TIMEOUT = 60000; // 60 seconds connection timeout

let lastData = null;
let socket = null;
let isReconnecting = false;

// Non-blocking file read
async function readBalanceState() {
    try {
        const data = await readFile(STATE_FILE, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        if (error.code !== 'ENOENT') {
            console.error('[ERROR] Failed to read state file:', error.message);
        }
        return null;
    }
}

// Send balance update
function sendBalanceUpdate(data) {
    if (!socket || !socket.connected) {
        console.log('[WARN] Socket not connected, skipping update');
        return;
    }

    socket.emit('balance:update', data);
}

// Check for changes and send updates
async function pollAndUpdate() {
    const data = await readBalanceState();

    if (!data) {
        return;
    }

    // Only send if data has changed (avoid spam)
    const dataStr = JSON.stringify(data);
    if (dataStr !== lastData) {
        lastData = dataStr;
        sendBalanceUpdate(data);
    }
}

// Connect to Socket.IO server
function connect() {
    if (isReconnecting) {
        return;
    }

    console.log('[INFO] Connecting to Socket.IO server...');
    console.log('[INFO] URL:', SOCKET_URL);

    socket = io(SOCKET_URL, {
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        reconnectionAttempts: Infinity,
        timeout: CONNECTION_TIMEOUT,
        forceNew: false,
        upgrade: true,
        rememberUpgrade: false
    });

    socket.on('connect', () => {
        console.log('[INFO] Connected to Socket.IO server');
        console.log('[INFO] Socket ID:', socket.id);
        isReconnecting = false;

        // Send current state immediately on connect
        readBalanceState().then(data => {
            if (data) {
                lastData = JSON.stringify(data);
                sendBalanceUpdate(data);
                console.log('[INFO] Initial balance state sent');
            }
        });
    });

    socket.on('connected', (data) => {
        console.log('[INFO] Server acknowledged connection:', data.message);
    });

    socket.on('balance:ack', (data) => {
        console.log('[ACK] Balance saved:', data.id);
    });

    socket.on('balance:error', (error) => {
        console.error('[ERROR] Balance error:', error);
    });

    socket.on('pong', (data) => {
        // Silent - don't spam logs
    });

    socket.on('disconnect', (reason) => {
        console.log('[WARN] Disconnected:', reason);
        isReconnecting = true;
    });

    socket.on('connect_error', (error) => {
        console.error('[ERROR] Connection error:', error.message);
        console.error('[ERROR] Error type:', error.type);
        if (error.description) {
            console.error('[ERROR] Description:', error.description);
        }
        if (error.context) {
            console.error('[ERROR] Context:', error.context);
        }
    });

    socket.on('reconnect', (attemptNumber) => {
        console.log('[INFO] Reconnected after', attemptNumber, 'attempts');
        isReconnecting = false;
    });

    socket.on('reconnect_attempt', (attemptNumber) => {
        console.log('[INFO] Reconnection attempt', attemptNumber);
    });

    socket.on('reconnect_error', (error) => {
        console.error('[ERROR] Reconnection error:', error.message);
    });

    socket.on('reconnect_failed', () => {
        console.error('[ERROR] Reconnection failed after all attempts');
    });
}

// Start polling
function startPolling() {
    console.log('[INFO] Starting balance reporter...');
    console.log('[INFO] State file:', STATE_FILE);
    console.log('[INFO] Poll interval:', POLL_INTERVAL, 'ms');

    // Initial read
    pollAndUpdate();

    // Poll periodically
    setInterval(pollAndUpdate, POLL_INTERVAL);
}

// Send ping periodically
function startHeartbeat() {
    setInterval(() => {
        if (socket && socket.connected) {
            socket.emit('ping');
        }
    }, PING_INTERVAL);
}

// Graceful shutdown
function shutdown() {
    console.log('\n[INFO] Shutting down...');
    if (socket) {
        socket.disconnect();
    }
    process.exit(0);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

// Start service
connect();
startPolling();
startHeartbeat();

console.log('[INFO] Balance reporter running. Press Ctrl+C to stop.');

