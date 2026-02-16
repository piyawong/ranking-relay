'use client';

import { useEffect, useRef, useCallback, useState } from 'react';
import type { Socket } from 'socket.io-client';

/**
 * Live data for a relay node (from collector service).
 */
export interface RelayLiveData {
  nodeId: string;
  nodeName: string;
  meshPeerCount: number;
  meshPeers: Array<{ topic: string; peers: Array<{ peer_id: string; [key: string]: unknown }> }> | null;
  peerCount: number;
  peers: Array<{ peer_id: string; [key: string]: unknown }> | null;
  trustedPeers: string[] | null;
  config: Record<string, unknown> | null;
  healthStatus: string | null;
  discoveryStats: Record<string, unknown> | null;
  lastError: string | null;
  isOnline: boolean;
  updatedAt: string;
}

interface RelayUpdateEvent {
  data: RelayLiveData;
}

interface RelayBulkUpdateEvent {
  data: RelayLiveData[];
  timestamp: string;
}

interface UseRelaySocketOptions {
  url?: string;
  onUpdate?: (data: RelayLiveData) => void;
  onBulkUpdate?: (data: RelayLiveData[], timestamp: string) => void;
  onConnect?: () => void;
  onDisconnect?: () => void;
  autoConnect?: boolean;
}

/**
 * Custom hook for WebSocket connection to relay data stream.
 *
 * @param options Configuration options
 * @returns Socket connection state and control functions
 */
export function useRelaySocket(options: UseRelaySocketOptions = {}) {
  const {
    url = typeof window !== 'undefined'
      ? `${window.location.protocol}//${window.location.hostname}:3001`
      : 'http://localhost:3001',
    onUpdate,
    onBulkUpdate,
    onConnect,
    onDisconnect,
    autoConnect = true,
  } = options;

  const socketRef = useRef<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [lastUpdate, setLastUpdate] = useState<string | null>(null);

  // Use refs for callbacks to prevent reconnection when they change
  const onUpdateRef = useRef(onUpdate);
  const onBulkUpdateRef = useRef(onBulkUpdate);
  const onConnectRef = useRef(onConnect);
  const onDisconnectRef = useRef(onDisconnect);

  // Update refs when callbacks change
  useEffect(() => {
    onUpdateRef.current = onUpdate;
    onBulkUpdateRef.current = onBulkUpdate;
    onConnectRef.current = onConnect;
    onDisconnectRef.current = onDisconnect;
  }, [onUpdate, onBulkUpdate, onConnect, onDisconnect]);

  const connect = useCallback(async () => {
    if (socketRef.current?.connected) {
      console.log('[RelaySocket] Already connected');
      return;
    }

    try {
      // Dynamically import socket.io-client to avoid SSR issues
      const { default: io } = await import('socket.io-client');

      console.log(`[RelaySocket] Connecting to ${url}...`);
      const socket = io(url, {
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        reconnectionAttempts: 10,
      });

      socket.on('connect', () => {
        console.log('[RelaySocket] Connected successfully');
        setIsConnected(true);
        setError(null);
        onConnectRef.current?.();
      });

      socket.on('disconnect', (reason) => {
        console.log('[RelaySocket] Disconnected:', reason);
        setIsConnected(false);
        onDisconnectRef.current?.();
      });

      socket.on('connect_error', (err) => {
        console.error('[RelaySocket] Connection error:', err);
        setError(err as Error);
        setIsConnected(false);
      });

      socket.on('connected', (data) => {
        console.log('[RelaySocket] Server acknowledged:', data);
      });

      // Handle single relay update
      socket.on('relay:update', (event: RelayUpdateEvent) => {
        console.log('[RelaySocket] Relay update received:', event.data?.nodeName);
        setLastUpdate(new Date().toISOString());
        onUpdateRef.current?.(event.data);
      });

      // Handle bulk relay update
      socket.on('relay:bulk-update', (event: RelayBulkUpdateEvent) => {
        console.log(`[RelaySocket] Bulk update: ${event.data?.length || 0} nodes`);
        setLastUpdate(event.timestamp);
        onBulkUpdateRef.current?.(event.data, event.timestamp);
      });

      socketRef.current = socket;
    } catch (err) {
      console.error('[RelaySocket] Failed to initialize:', err);
      setError(err as Error);
    }
  }, [url]);

  const disconnect = useCallback(() => {
    if (socketRef.current) {
      console.log('[RelaySocket] Disconnecting...');
      socketRef.current.disconnect();
      socketRef.current = null;
      setIsConnected(false);
    }
  }, []);

  /**
   * Request a force refresh from the collector service.
   *
   * @param nodeId Optional node ID to refresh. If not provided, refreshes all nodes.
   */
  const forceRefresh = useCallback((nodeId?: string) => {
    if (socketRef.current?.connected) {
      console.log('[RelaySocket] Requesting force refresh', nodeId ? `for ${nodeId}` : 'for all nodes');
      socketRef.current.emit('relay:force-refresh', nodeId ? { nodeId } : undefined);
    } else {
      console.warn('[RelaySocket] Cannot force refresh: not connected');
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
    lastUpdate,
    connect,
    disconnect,
    forceRefresh,
    sendPing,
    socket: socketRef.current,
  };
}
