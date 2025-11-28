'use client';

import { useEffect, useRef, useCallback, useState } from 'react';
import type { Socket } from 'socket.io-client';

interface BalanceSnapshot {
  id: string;
  ts: string;
  pid?: number | null;
  onchain: {
    rlb: number;
    usdt: number;
  };
  onsite: {
    rlb: number;
    usd: number;
  };
}

interface UseWebSocketOptions {
  url?: string;
  onBalanceSnapshot?: (data: BalanceSnapshot) => void;
  onConnect?: () => void;
  onDisconnect?: () => void;
  autoConnect?: boolean;
}

/**
 * Custom hook for WebSocket connection to balance server
 *
 * @param options Configuration options for WebSocket connection
 * @returns WebSocket connection status and control functions
 */
export function useWebSocket(options: UseWebSocketOptions = {}) {
  const {
    url = typeof window !== 'undefined'
      ? `${window.location.protocol}//${window.location.hostname}:3001`
      : 'http://localhost:3001',
    onBalanceSnapshot,
    onConnect,
    onDisconnect,
    autoConnect = true
  } = options;

  const socketRef = useRef<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  // Use refs for callbacks to prevent reconnection when they change
  const onBalanceSnapshotRef = useRef(onBalanceSnapshot);
  const onConnectRef = useRef(onConnect);
  const onDisconnectRef = useRef(onDisconnect);

  // Update refs when callbacks change
  useEffect(() => {
    onBalanceSnapshotRef.current = onBalanceSnapshot;
    onConnectRef.current = onConnect;
    onDisconnectRef.current = onDisconnect;
  }, [onBalanceSnapshot, onConnect, onDisconnect]);

  const connect = useCallback(async () => {
    if (socketRef.current?.connected) {
      console.log('[WebSocket] Already connected');
      return;
    }

    try {
      // Dynamically import socket.io-client to avoid SSR issues
      const { default: io } = await import('socket.io-client');

      console.log(`[WebSocket] Connecting to ${url}...`);
      const socket = io(url, {
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        reconnectionAttempts: 10
      });

      socket.on('connect', () => {
        console.log('[WebSocket] Connected successfully');
        setIsConnected(true);
        setError(null);
        onConnectRef.current?.();
      });

      socket.on('disconnect', (reason) => {
        console.log('[WebSocket] Disconnected:', reason);
        setIsConnected(false);
        onDisconnectRef.current?.();
      });

      socket.on('connect_error', (err) => {
        console.error('[WebSocket] Connection error:', err);
        setError(err as Error);
        setIsConnected(false);
      });

      socket.on('connected', (data) => {
        console.log('[WebSocket] Server acknowledged:', data);
      });

      socket.on('balance:snapshot', (data: BalanceSnapshot) => {
        console.log('[WebSocket] Balance snapshot received:', data);
        onBalanceSnapshotRef.current?.(data);
      });

      socketRef.current = socket;
    } catch (err) {
      console.error('[WebSocket] Failed to initialize:', err);
      setError(err as Error);
    }
  }, [url]);

  const disconnect = useCallback(() => {
    if (socketRef.current) {
      console.log('[WebSocket] Disconnecting...');
      socketRef.current.disconnect();
      socketRef.current = null;
      setIsConnected(false);
    }
  }, []);

  const sendPing = useCallback(() => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('ping');
    }
  }, []);

  useEffect(() => {
    if (autoConnect) {
      connect();
    }

    return () => {
      disconnect();
    };
  }, [autoConnect, connect, disconnect]);

  return {
    isConnected,
    error,
    connect,
    disconnect,
    sendPing,
    socket: socketRef.current
  };
}
