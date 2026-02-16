/**
 * Types for relay collector service.
 */

export interface RelayNode {
  id: string;
  name: string;
  endpoint: string | null;
  port: number;
  status: string;
}

export interface MeshPeer {
  peer_id: string;
  [key: string]: unknown;
}

export interface MeshTopic {
  topic: string;
  peers: MeshPeer[];
}

export interface PeerInfo {
  peer_id: string;
  direction: string;
  enr: string;
  client: string;
  [key: string]: unknown;
}

export interface DiscoveryStats {
  sessions_count?: number;
  active_sessions?: number;
  connected_peers?: number;
  [key: string]: unknown;
}

export interface NodeConfig {
  max_latency_ms?: number;
  target_peers?: number;
  [key: string]: unknown;
}

export interface CollectedData {
  nodeId: string;
  nodeName: string;
  meshPeerCount: number;
  meshPeers: MeshTopic[] | null;
  peerCount: number;
  peers: PeerInfo[] | null;
  trustedPeers: string[] | null;
  config: NodeConfig | null;
  healthStatus: string | null;
  discoveryStats: DiscoveryStats | null;
  lastError: string | null;
  isOnline: boolean;
  updatedAt: Date;
}

export interface RelayUpdateEvent {
  type: 'relay:update';
  data: CollectedData;
}

export interface RelayBulkUpdateEvent {
  type: 'relay:bulk-update';
  data: CollectedData[];
  timestamp: string;
}
