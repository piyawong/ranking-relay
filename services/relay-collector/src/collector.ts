/**
 * Relay data collector service.
 *
 * Polls relay nodes every 10 seconds and updates the database.
 * Emits events via Socket.IO to notify connected clients.
 */

import { PrismaClient } from '@prisma/client';
import { io, Socket } from 'socket.io-client';
import {
  RelayNode,
  MeshTopic,
  PeerInfo,
  DiscoveryStats,
  NodeConfig,
  CollectedData,
} from './types';

const POLL_INTERVAL_MS = 10_000; // 10 seconds
const FETCH_TIMEOUT_MS = 8_000; // 8 seconds timeout per request

export class RelayCollector {
  private prisma: PrismaClient;
  private socket: Socket | null = null;
  private intervalId: NodeJS.Timeout | null = null;
  private isRunning = false;
  private socketUrl: string;

  constructor(socketUrl: string) {
    this.prisma = new PrismaClient();
    this.socketUrl = socketUrl;
  }

  /**
   * Start the collector service.
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      console.log('[Collector] Already running');
      return;
    }

    console.log('[Collector] Starting relay collector service...');

    // Connect to Socket.IO server
    this.connectSocket();

    // Run initial collection
    await this.collectAll();

    // Start polling interval
    this.intervalId = setInterval(async () => {
      await this.collectAll();
    }, POLL_INTERVAL_MS);

    this.isRunning = true;
    console.log(`[Collector] Started. Polling every ${POLL_INTERVAL_MS / 1000}s`);
  }

  /**
   * Stop the collector service.
   */
  async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    console.log('[Collector] Stopping...');

    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }

    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }

    await this.prisma.$disconnect();
    this.isRunning = false;
    console.log('[Collector] Stopped');
  }

  /**
   * Connect to Socket.IO server.
   */
  private connectSocket(): void {
    console.log(`[Collector] Connecting to Socket.IO at ${this.socketUrl}...`);

    this.socket = io(this.socketUrl, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: Infinity,
    });

    this.socket.on('connect', () => {
      console.log('[Collector] Socket.IO connected');
    });

    this.socket.on('disconnect', (reason) => {
      console.log(`[Collector] Socket.IO disconnected: ${reason}`);
    });

    this.socket.on('connect_error', (err) => {
      console.error('[Collector] Socket.IO connection error:', err.message);
    });

    // Listen for force refresh requests
    this.socket.on('relay:force-refresh', async (data?: { nodeId?: string }) => {
      console.log('[Collector] Force refresh requested', data);
      if (data?.nodeId) {
        await this.collectSingle(data.nodeId);
      } else {
        await this.collectAll();
      }
    });
  }

  /**
   * Collect data from all active relay nodes.
   */
  async collectAll(): Promise<void> {
    const startTime = Date.now();

    try {
      // Get all relay nodes with endpoints
      const nodes = await this.prisma.relayNode.findMany({
        where: {
          endpoint: { not: null },
          status: { not: 'inactive' },
        },
        select: {
          id: true,
          name: true,
          endpoint: true,
          port: true,
          status: true,
        },
      });

      if (nodes.length === 0) {
        console.log('[Collector] No active nodes with endpoints found');
        return;
      }

      console.log(`[Collector] Collecting data from ${nodes.length} nodes...`);

      // Collect from all nodes in parallel
      const results = await Promise.all(
        nodes.map((node) => this.collectFromNode(node as RelayNode))
      );

      // Filter out null results
      const validResults = results.filter((r): r is CollectedData => r !== null);

      // Broadcast bulk update
      if (this.socket?.connected && validResults.length > 0) {
        this.socket.emit('relay:bulk-update', {
          data: validResults,
          timestamp: new Date().toISOString(),
        });
      }

      const duration = Date.now() - startTime;
      console.log(
        `[Collector] Collected ${validResults.length}/${nodes.length} nodes in ${duration}ms`
      );
    } catch (error) {
      console.error('[Collector] Error collecting data:', error);
    }
  }

  /**
   * Collect data from a single node by ID.
   */
  async collectSingle(nodeId: string): Promise<void> {
    try {
      const node = await this.prisma.relayNode.findUnique({
        where: { id: nodeId },
        select: {
          id: true,
          name: true,
          endpoint: true,
          port: true,
          status: true,
        },
      });

      if (!node || !node.endpoint) {
        console.log(`[Collector] Node ${nodeId} not found or has no endpoint`);
        return;
      }

      const result = await this.collectFromNode(node as RelayNode);

      // Broadcast single update
      if (this.socket?.connected && result) {
        this.socket.emit('relay:update', { data: result });
      }
    } catch (error) {
      console.error(`[Collector] Error collecting from node ${nodeId}:`, error);
    }
  }

  /**
   * Collect data from a single relay node.
   */
  private async collectFromNode(node: RelayNode): Promise<CollectedData | null> {
    if (!node.endpoint) {
      return null;
    }

    const baseUrl = `http://${node.endpoint}:${node.port}`;
    let isOnline = false;
    let lastError: string | null = null;

    // Fetch all data in parallel
    const [meshResult, peersResult, trustedResult, configResult, healthResult, discoveryResult] =
      await Promise.all([
        this.fetchWithTimeout<MeshTopic[]>(`${baseUrl}/mesh`),
        this.fetchWithTimeout<PeerInfo[]>(`${baseUrl}/peers`),
        this.fetchWithTimeout<string[]>(`${baseUrl}/peers/trusted`),
        this.fetchWithTimeout<NodeConfig>(`${baseUrl}/config`),
        this.fetchWithTimeout<{ data?: { sync_distance?: number } }>(`${baseUrl}/eth/v1/node/health`),
        this.fetchWithTimeout<DiscoveryStats>(`${baseUrl}/discovery/stats`),
      ]);

    // Calculate mesh peer count
    let meshPeerCount = 0;
    if (meshResult.data) {
      meshPeerCount = meshResult.data.reduce(
        (sum, topic) => sum + (topic.peers?.length || 0),
        0
      );
      isOnline = true;
    }

    // Calculate peer count
    const peerCount = peersResult.data?.length || 0;
    if (peersResult.data) {
      isOnline = true;
    }

    // Determine health status
    let healthStatus: string | null = null;
    if (healthResult.data) {
      const syncDistance = healthResult.data?.data?.sync_distance;
      if (syncDistance !== undefined) {
        healthStatus = syncDistance < 2 ? 'healthy' : 'syncing';
      } else {
        healthStatus = 'healthy';
      }
      isOnline = true;
    } else if (healthResult.error) {
      healthStatus = 'error';
      lastError = healthResult.error;
    }

    // Collect any errors
    const errors = [
      meshResult.error,
      peersResult.error,
      configResult.error,
      healthResult.error,
    ].filter(Boolean);

    if (errors.length > 0 && !lastError) {
      lastError = errors[0] || null;
    }

    // If all requests failed, node is offline
    if (!meshResult.data && !peersResult.data && !healthResult.data) {
      isOnline = false;
    }

    const collectedData: CollectedData = {
      nodeId: node.id,
      nodeName: node.name,
      meshPeerCount,
      meshPeers: meshResult.data || null,
      peerCount,
      peers: peersResult.data || null,
      trustedPeers: trustedResult.data || null,
      config: configResult.data || null,
      healthStatus,
      discoveryStats: discoveryResult.data || null,
      lastError,
      isOnline,
      updatedAt: new Date(),
    };

    // Save to database
    await this.saveToDatabase(collectedData);

    return collectedData;
  }

  /**
   * Fetch data from URL with timeout.
   */
  private async fetchWithTimeout<T>(
    url: string
  ): Promise<{ data: T | null; error: string | null }> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: { Accept: 'application/json' },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        return { data: null, error: `HTTP ${response.status}` };
      }

      const data = await response.json();
      return { data: data as T, error: null };
    } catch (error) {
      clearTimeout(timeoutId);

      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          return { data: null, error: 'Timeout' };
        }
        return { data: null, error: error.message };
      }
      return { data: null, error: 'Unknown error' };
    }
  }

  /**
   * Save collected data to database.
   */
  private async saveToDatabase(data: CollectedData): Promise<void> {
    try {
      await this.prisma.relayLiveData.upsert({
        where: { node_id: data.nodeId },
        create: {
          node_id: data.nodeId,
          mesh_peer_count: data.meshPeerCount,
          mesh_peers: data.meshPeers as object,
          peer_count: data.peerCount,
          peers: data.peers as object,
          trusted_peers: data.trustedPeers as object,
          config: data.config as object,
          health_status: data.healthStatus,
          discovery_stats: data.discoveryStats as object,
          last_error: data.lastError,
          is_online: data.isOnline,
        },
        update: {
          mesh_peer_count: data.meshPeerCount,
          mesh_peers: data.meshPeers as object,
          peer_count: data.peerCount,
          peers: data.peers as object,
          trusted_peers: data.trustedPeers as object,
          config: data.config as object,
          health_status: data.healthStatus,
          discovery_stats: data.discoveryStats as object,
          last_error: data.lastError,
          is_online: data.isOnline,
        },
      });
    } catch (error) {
      console.error(`[Collector] Failed to save data for node ${data.nodeId}:`, error);
    }
  }
}
