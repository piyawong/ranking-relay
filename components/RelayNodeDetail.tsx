'use client';

import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  RefreshCw,
  Users,
  Shield,
  Activity,
  Settings,
  Link2,
  Unlink,
  Plus,
  Trash2,
  Server,
  Wifi,
  Clock,
  MapPin,
  AlertCircle,
  Copy,
  Check,
  Search,
  Info,
  Network,
  Hash,
  Ban,
  ShieldOff,
  Minus,
  GitMerge,
  BarChart3,
  ExternalLink,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface RelayNode {
  id: string;
  name: string;
  tag: string | null;
  description: string | null;
  latitude: number;
  longitude: number;
  location: string | null;
  country: string | null;
  status: string;
  endpoint: string | null;
  port: number;
}

interface Peer {
  peer_id: string;
  address: string;
  direction: string;
  state: string;
  rtt_ms: number;
  best_rtt_ms: number;
  rtt_verified: boolean;
  is_trusted: boolean;
  score: number;
  peer_score: number;
  gossipsub_score: number;
  gossipsub_score_weighted: number;
  client: string;
}

interface TrustedPeer {
  peer_id: string;
  enr: string;
  is_connected: boolean;
}

interface DiscoveryStats {
  unique_peers_discovered: number;
  routing_table_size: number;
  cached_enrs: number;
  total_discovery_queries: number;
  dht_scan_prefix: number;
  kademlia_alpha: number;
  kademlia_k: number;
  target_peers_per_query: number;
}

interface Config {
  target_peers: number;
  max_latency_ms: number;
  network_load: number;
  heartbeat_interval_ms: number;
  discovery_interval_ms: number;
}

// Network load level descriptions
const networkLoadLevels: Record<number, { name: string; mesh_n: number; heartbeat: string }> = {
  1: { name: 'Low', mesh_n: 3, heartbeat: '1200ms' },
  2: { name: 'Low', mesh_n: 4, heartbeat: '1000ms' },
  3: { name: 'Average', mesh_n: 5, heartbeat: '1000ms' },
  4: { name: 'Average', mesh_n: 8, heartbeat: '1000ms' },
  5: { name: 'High', mesh_n: 10, heartbeat: '700ms' },
  6: { name: 'VeryHigh', mesh_n: 12, heartbeat: '600ms' },
  7: { name: 'VeryHigh', mesh_n: 14, heartbeat: '600ms' },
  8: { name: 'Ultra', mesh_n: 16, heartbeat: '500ms' },
  9: { name: 'Ultra', mesh_n: 18, heartbeat: '500ms' },
  10: { name: 'Maximum', mesh_n: 20, heartbeat: '400ms' },
  11: { name: 'Extreme', mesh_n: 22, heartbeat: '400ms' },
  12: { name: 'Extreme', mesh_n: 24, heartbeat: '350ms' },
  13: { name: 'Extreme', mesh_n: 26, heartbeat: '350ms' },
  14: { name: 'Turbo', mesh_n: 28, heartbeat: '300ms' },
  15: { name: 'Turbo', mesh_n: 30, heartbeat: '300ms' },
  16: { name: 'Hyper', mesh_n: 32, heartbeat: '250ms' },
  17: { name: 'Hyper', mesh_n: 34, heartbeat: '250ms' },
  18: { name: 'Insane', mesh_n: 36, heartbeat: '200ms' },
  19: { name: 'Insane', mesh_n: 38, heartbeat: '200ms' },
  20: { name: 'Ludicrous', mesh_n: 40, heartbeat: '200ms' },
  21: { name: 'Ludicrous', mesh_n: 42, heartbeat: '180ms' },
  22: { name: 'Absurd', mesh_n: 44, heartbeat: '180ms' },
  23: { name: 'Absurd', mesh_n: 46, heartbeat: '160ms' },
  24: { name: 'Absurd', mesh_n: 48, heartbeat: '160ms' },
  25: { name: 'Ridiculous', mesh_n: 50, heartbeat: '150ms' },
  26: { name: 'Ridiculous', mesh_n: 52, heartbeat: '150ms' },
  27: { name: 'Ridiculous', mesh_n: 54, heartbeat: '140ms' },
  28: { name: 'Plaid', mesh_n: 56, heartbeat: '140ms' },
  29: { name: 'Plaid', mesh_n: 58, heartbeat: '130ms' },
  30: { name: 'Plaid', mesh_n: 60, heartbeat: '130ms' },
  31: { name: 'Warp', mesh_n: 62, heartbeat: '120ms' },
  32: { name: 'Warp', mesh_n: 64, heartbeat: '120ms' },
  33: { name: 'Warp', mesh_n: 66, heartbeat: '110ms' },
  34: { name: 'Lightspeed', mesh_n: 68, heartbeat: '110ms' },
  35: { name: 'Lightspeed', mesh_n: 70, heartbeat: '100ms' },
  36: { name: 'Lightspeed', mesh_n: 72, heartbeat: '100ms' },
  37: { name: 'Superluminal', mesh_n: 74, heartbeat: '90ms' },
  38: { name: 'Superluminal', mesh_n: 76, heartbeat: '90ms' },
  39: { name: 'Superluminal', mesh_n: 78, heartbeat: '80ms' },
  40: { name: 'GodMode', mesh_n: 80, heartbeat: '80ms' },
};

interface BannedPeer {
  peer_id: string;
  ban_type: 'permanent' | 'temporary';
}

interface NodeMetadata {
  seq_number: string;
  attnets: string;
  syncnets: string;
  custody_group_count: string;
}

interface NodeInfo {
  peer_id: string;
  enr: string;
  p2p_addresses: string[];
  discovery_addresses: string[];
  metadata: NodeMetadata;
}

interface MeshTopic {
  topic: string;
  kind: string;
  peers: { peer_id: string; client: string }[];
}

interface FirstBlockSender {
  peer_id: string;
  count: number;
}

interface MeshPeer {
  peer_id: string;
  client: string;
}

interface MeshTopicData {
  topic: string;
  kind?: string;
  peers: MeshPeer[];
}

interface PeerData {
  peer_id: string;
  address: string;
  direction: string;
  state: string;
  rtt_ms: number;
  best_rtt_ms: number;
  rtt_verified: boolean;
  is_trusted: boolean;
  score: number;
  peer_score: number;
  gossipsub_score: number;
  gossipsub_score_weighted: number;
  client: string;
}

interface ConfigData {
  target_peers: number;
  max_latency_ms: number;
  network_load: number;
  heartbeat_interval_ms: number;
  discovery_interval_ms: number;
}

interface DiscoveryData {
  unique_peers_discovered: number;
  routing_table_size: number;
  cached_enrs: number;
  total_discovery_queries: number;
  dht_scan_prefix: number;
  kademlia_alpha: number;
  kademlia_k: number;
  target_peers_per_query: number;
}

interface TrustedPeerData {
  peer_id: string;
  enr?: string;
  is_connected?: boolean;
}

/**
 * Full live data from socket/DB for a relay node.
 * This contains all data that the collector service fetches and stores.
 * Uses generic types to be compatible with RelayLiveData from socket hook.
 */
interface FullLiveData {
  nodeId: string;
  nodeName?: string;
  meshPeerCount: number;
  meshPeers: Array<{ topic: string; kind?: string; peers: Array<{ peer_id: string; client?: string; [key: string]: unknown }> }> | null;
  peerCount: number;
  peers: Array<{ peer_id: string; [key: string]: unknown }> | null;
  trustedPeers: Array<string | { peer_id: string; [key: string]: unknown }> | null;
  config: Record<string, unknown> | null;
  healthStatus: string | null;
  discoveryStats: Record<string, unknown> | null;
  lastError: string | null;
  isOnline: boolean;
  updatedAt: string;
}

interface RelayNodeDetailProps {
  node: RelayNode;
  onClose?: () => void;
  onConfigChange?: () => void;
  /** Full live data from socket/DB. If provided, component won't poll for this data. */
  liveData?: FullLiveData | null;
}

// Helper to build proxy URL
function buildProxyUrl(endpoint: string, path: string, port: number = 5052): string {
  return `/api/relay-proxy?endpoint=${encodeURIComponent(endpoint)}&path=${encodeURIComponent(path)}&port=${port}`;
}

// Helper to parse client string and extract name and version
function parseClientInfo(client: string): { name: string; version: string; full: string } {
  if (!client) return { name: 'Unknown', version: '', full: '' };

  // Format: "ClientName: version: xxx, os_version: xxx" or "ClientName: extra" or just "ClientName"
  const colonIndex = client.indexOf(':');
  if (colonIndex === -1) {
    return { name: client, version: '', full: client };
  }

  const name = client.substring(0, colonIndex).trim();
  const rest = client.substring(colonIndex + 1).trim();

  // Try to extract version
  const versionMatch = rest.match(/version:\s*([^,]+)/i);
  const version = versionMatch ? versionMatch[1].trim() : rest;

  return { name, version, full: client };
}

export default function RelayNodeDetail({ node, onClose, onConfigChange, liveData }: RelayNodeDetailProps) {
  const queryClient = useQueryClient();

  // Open popup window for this node
  const openPopup = () => {
    const width = 800;
    const height = 700;
    const left = (window.screen.width - width) / 2;
    const top = (window.screen.height - height) / 2;
    window.open(
      `/relays/manage/${node.id}`,
      `manage-${node.id}`,
      `width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=yes`
    );
  };
  const [connectEnr, setConnectEnr] = useState('');
  const [connectMultiaddr, setConnectMultiaddr] = useState('');
  const [addTrustedEnr, setAddTrustedEnr] = useState('');
  const [targetPeers, setTargetPeers] = useState('');
  const [maxLatency, setMaxLatency] = useState('');
  const [networkLoad, setNetworkLoad] = useState('');
  const [heartbeatInterval, setHeartbeatInterval] = useState('');
  const [discoveryInterval, setDiscoveryInterval] = useState('');
  const [copiedPeerId, setCopiedPeerId] = useState<string | null>(null);

  // Peer filter states
  const [peerSearch, setPeerSearch] = useState('');
  const [trustedFilter, setTrustedFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [directionFilter, setDirectionFilter] = useState('all');

  // Trusted peer filter states
  const [trustedSearch, setTrustedSearch] = useState('');
  const [trustedStatusFilter, setTrustedStatusFilter] = useState('all');

  // Banned peer filter states
  const [bannedSearch, setBannedSearch] = useState('');
  const [bannedTypeFilter, setBannedTypeFilter] = useState('all');
  const [banPeerId, setBanPeerId] = useState('');

  // Graft to mesh state
  const [graftPeerId, setGraftPeerId] = useState<string | null>(null);

  // Mesh search state
  const [meshSearch, setMeshSearch] = useState('');

  // Stats search state
  const [statsSearch, setStatsSearch] = useState('');

  const copyToClipboard = async (peerId: string) => {
    try {
      await navigator.clipboard.writeText(peerId);
      setCopiedPeerId(peerId);
      setTimeout(() => setCopiedPeerId(null), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const endpoint = node.endpoint || null;
  const port = node.port || 5052;

  // Use live data from props if available (from socket/DB)
  // Only poll via HTTP if liveData is not provided (e.g., in popup window)
  const hasLiveData = !!liveData;

  // Check if node is known to be offline from liveData
  // If offline, skip all HTTP polling to avoid 502 errors
  const isKnownOffline = liveData?.isOnline === false;

  // Fetch peers - GET /peers (skip if liveData is available or node is offline)
  const { data: peersDataPolled, isLoading: peersLoading, refetch: refetchPeers } = useQuery({
    queryKey: ['relay-peers', node.id],
    queryFn: async () => {
      if (!endpoint) return [];
      const res = await fetch(buildProxyUrl(endpoint, '/peers', port));
      if (!res.ok) throw new Error('Failed to fetch peers');
      return res.json() as Promise<Peer[]>;
    },
    enabled: !!endpoint && !hasLiveData && !isKnownOffline,
    refetchInterval: hasLiveData || isKnownOffline ? false : 10000,
  });

  // Fetch trusted peers - GET /peers/trusted (skip if liveData is available or node is offline)
  const { data: trustedPeersDataPolled, isLoading: trustedLoading, refetch: refetchTrusted } = useQuery({
    queryKey: ['relay-trusted-peers', node.id],
    queryFn: async () => {
      if (!endpoint) return [];
      const res = await fetch(buildProxyUrl(endpoint, '/peers/trusted', port));
      if (!res.ok) throw new Error('Failed to fetch trusted peers');
      return res.json() as Promise<TrustedPeer[]>;
    },
    enabled: !!endpoint && !hasLiveData && !isKnownOffline,
  });

  // Fetch discovery stats - GET /discovery/stats (skip if liveData is available or node is offline)
  const { data: discoveryDataPolled, isLoading: discoveryLoading, refetch: refetchDiscovery } = useQuery({
    queryKey: ['relay-discovery', node.id],
    queryFn: async () => {
      if (!endpoint) return null;
      const res = await fetch(buildProxyUrl(endpoint, '/discovery/stats', port));
      if (!res.ok) throw new Error('Failed to fetch discovery stats');
      return res.json() as Promise<DiscoveryStats>;
    },
    enabled: !!endpoint && !hasLiveData && !isKnownOffline,
  });

  // Fetch current config - GET /config (ALWAYS fetch directly, don't rely on liveData for config)
  // This ensures config updates immediately after mutations
  const { data: configDataPolled, isLoading: configLoading, refetch: refetchConfig } = useQuery({
    queryKey: ['relay-config', node.id],
    queryFn: async () => {
      if (!endpoint) return null;
      const res = await fetch(buildProxyUrl(endpoint, '/config', port));
      if (!res.ok) throw new Error('Failed to fetch config');
      return res.json() as Promise<Config>;
    },
    enabled: !!endpoint && !isKnownOffline,
  });

  // Use live data if available, otherwise use polled data
  const peersData = liveData?.peers ?? peersDataPolled ?? [];
  const trustedPeersData = liveData?.trustedPeers ?? trustedPeersDataPolled ?? [];
  // Cast config and discovery data to their proper types for safe property access
  const discoveryData = (liveData?.discoveryStats ?? discoveryDataPolled ?? null) as DiscoveryStats | null;
  // For config, prefer polled data since it updates immediately after mutations
  const configData = (configDataPolled ?? liveData?.config ?? null) as Config | null;

  // Fetch node info - GET /node/info (skip if node is known to be offline)
  const { data: nodeInfoData, isLoading: nodeInfoLoading, refetch: refetchNodeInfo } = useQuery({
    queryKey: ['relay-node-info', node.id],
    queryFn: async () => {
      if (!endpoint) return null;
      const res = await fetch(buildProxyUrl(endpoint, '/node/info', port));
      if (!res.ok) throw new Error('Failed to fetch node info');
      return res.json() as Promise<NodeInfo>;
    },
    enabled: !!endpoint && !isKnownOffline,
  });

  // Fetch banned peers - GET /peers/banned (skip if node is known to be offline)
  const { data: bannedPeersData, isLoading: bannedLoading, refetch: refetchBanned } = useQuery({
    queryKey: ['relay-banned-peers', node.id],
    queryFn: async () => {
      if (!endpoint) return [];
      const res = await fetch(buildProxyUrl(endpoint, '/peers/banned', port));
      if (!res.ok) throw new Error('Failed to fetch banned peers');
      return res.json() as Promise<BannedPeer[]>;
    },
    enabled: !!endpoint && !isKnownOffline,
  });

  // Health check - GET /eth/v1/node/health (skip if liveData is available or node is offline)
  const { data: healthStatusPolled } = useQuery({
    queryKey: ['relay-health', node.id],
    queryFn: async () => {
      if (!endpoint) return null;
      try {
        const res = await fetch(buildProxyUrl(endpoint, '/eth/v1/node/health', port));
        return res.status; // 200 = healthy, 206 = syncing
      } catch {
        return null; // offline
      }
    },
    enabled: !!endpoint && !hasLiveData && !isKnownOffline,
    refetchInterval: hasLiveData || isKnownOffline ? false : 30000,
  });

  // Fetch mesh - GET /mesh (skip if liveData is available or node is offline)
  const { data: meshDataPolled, isLoading: meshLoading, refetch: refetchMesh } = useQuery({
    queryKey: ['relay-mesh', node.id],
    queryFn: async () => {
      if (!endpoint) return [];
      const res = await fetch(buildProxyUrl(endpoint, '/mesh', port));
      if (!res.ok) throw new Error('Failed to fetch mesh');
      return res.json() as Promise<MeshTopicData[]>;
    },
    enabled: !!endpoint && !hasLiveData && !isKnownOffline,
  });

  // Use live data for health/mesh if available
  const healthStatus = liveData?.healthStatus
    ? (liveData.healthStatus === 'healthy' ? 200 : liveData.healthStatus === 'syncing' ? 206 : null)
    : healthStatusPolled;
  const meshData = liveData?.meshPeers ?? meshDataPolled ?? [];

  // Fetch first-block-sender stats - GET /stats/first-block-sender (skip if node is offline)
  const { data: firstBlockSenderData, isLoading: firstBlockSenderLoading, refetch: refetchFirstBlockSender } = useQuery({
    queryKey: ['relay-first-block-sender', node.id],
    queryFn: async () => {
      if (!endpoint) return [];
      const res = await fetch(buildProxyUrl(endpoint, '/stats/first-block-sender', port));
      if (!res.ok) throw new Error('Failed to fetch first block sender stats');
      return res.json() as Promise<FirstBlockSender[]>;
    },
    enabled: !!endpoint && !isKnownOffline,
    refetchInterval: isKnownOffline ? false : 30000, // Refresh every 30 seconds if online
  });

  // Connect peer mutation - POST /peers
  const connectPeerMutation = useMutation({
    mutationFn: async ({ enr, multiaddr }: { enr?: string; multiaddr?: string }) => {
      if (!endpoint) throw new Error('No endpoint configured');
      const body = enr ? { enr } : { multiaddr };
      const res = await fetch(buildProxyUrl(endpoint, '/peers', port), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error('Failed to connect peer');
      return res.json();
    },
    onSuccess: () => {
      refetchPeers();
      setConnectEnr('');
      setConnectMultiaddr('');
    },
  });

  // Disconnect peer mutation - DELETE /peers/{peer_id}
  const disconnectPeerMutation = useMutation({
    mutationFn: async (peerId: string) => {
      if (!endpoint) throw new Error('No endpoint configured');
      const res = await fetch(buildProxyUrl(endpoint, `/peers/${peerId}`, port), {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error('Failed to disconnect peer');
      return res.json();
    },
    onSuccess: () => {
      refetchPeers();
      refetchTrusted();
    },
  });

  // Trust connected peer mutation - POST /peers/trusted/{peer_id}
  const trustPeerMutation = useMutation({
    mutationFn: async (peerId: string) => {
      if (!endpoint) throw new Error('No endpoint configured');
      const res = await fetch(buildProxyUrl(endpoint, `/peers/trusted/${peerId}`, port), {
        method: 'POST',
      });
      if (!res.ok) throw new Error('Failed to trust peer');
      return res.json();
    },
    onSuccess: () => {
      refetchPeers();
    },
  });

  // Remove trusted peer mutation - DELETE /peers/trusted/{peer_id}
  const removeTrustedPeerMutation = useMutation({
    mutationFn: async (peerId: string) => {
      if (!endpoint) throw new Error('No endpoint configured');
      const res = await fetch(buildProxyUrl(endpoint, `/peers/trusted/${peerId}`, port), {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error('Failed to remove trusted peer');
      return res.json();
    },
    onSuccess: () => {
      refetchTrusted();
    },
  });

  // Update config mutation - PATCH /config
  const updateConfigMutation = useMutation({
    mutationFn: async (config: { target_peers?: number; max_latency_ms?: number; network_load?: number; heartbeat_interval_ms?: number; discovery_interval_ms?: number }) => {
      if (!endpoint) throw new Error('No endpoint configured');
      console.log('[Config] Sending PATCH to', endpoint, 'with config:', config);
      const url = buildProxyUrl(endpoint, '/config', port);
      console.log('[Config] Full URL:', url);
      const res = await fetch(url, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      });
      console.log('[Config] Response status:', res.status);
      if (!res.ok) {
        const errorText = await res.text();
        console.error('[Config] Error response:', errorText);
        throw new Error(`Failed to update config: ${res.status} - ${errorText}`);
      }
      const result = await res.json();
      console.log('[Config] Success response:', result);
      return result;
    },
    onSuccess: (data) => {
      console.log('[Config] Mutation success, refetching config...');
      refetchConfig();
      setTargetPeers('');
      setMaxLatency('');
      setNetworkLoad('');
      setHeartbeatInterval('');
      setDiscoveryInterval('');
      // Notify parent to refresh map coverage
      onConfigChange?.();
    },
    onError: (error) => {
      console.error('[Config] Mutation error:', error);
      alert(`Failed to update config: ${error.message}`);
    },
  });

  // Ban peer mutation - POST /peers/{peer_id}/ban
  const banPeerMutation = useMutation({
    mutationFn: async (peerId: string) => {
      if (!endpoint) throw new Error('No endpoint configured');
      const res = await fetch(buildProxyUrl(endpoint, `/peers/${peerId}/ban`, port), {
        method: 'POST',
      });
      if (!res.ok) throw new Error('Failed to ban peer');
      return res.json();
    },
    onSuccess: () => {
      refetchBanned();
      refetchPeers();
      refetchTrusted();
    },
  });

  // Unban peer mutation - DELETE /peers/{peer_id}/ban
  const unbanPeerMutation = useMutation({
    mutationFn: async (peerId: string) => {
      if (!endpoint) throw new Error('No endpoint configured');
      const res = await fetch(buildProxyUrl(endpoint, `/peers/${peerId}/ban`, port), {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error('Failed to unban peer');
      return res.json();
    },
    onSuccess: () => {
      refetchBanned();
    },
  });

  // Add explicit peer mutation - POST /mesh/explicit/{peer_id}
  const addExplicitPeerMutation = useMutation({
    mutationFn: async (peerId: string) => {
      if (!endpoint) throw new Error('No endpoint configured');
      console.log('[Mesh] Adding explicit peer:', peerId);
      const url = buildProxyUrl(endpoint, `/mesh/explicit/${peerId}`, port);
      console.log('[Mesh] URL:', url);
      const res = await fetch(url, {
        method: 'POST',
      });
      console.log('[Mesh] Response status:', res.status);
      if (!res.ok) {
        const errorText = await res.text();
        console.error('[Mesh] Error:', errorText);
        throw new Error(`Failed to add explicit peer: ${errorText}`);
      }
      const data = await res.json();
      console.log('[Mesh] Success:', data);
      return data;
    },
    onSuccess: (data) => {
      console.log('[Mesh] Mutation success, refetching mesh...');
      alert(`Added peer to explicit: ${data.peer_id}`);
      refetchMesh();
    },
    onError: (error) => {
      console.error('[Mesh] Mutation error:', error);
      alert(`Failed to add explicit peer: ${error.message}`);
    },
  });

  // Remove explicit peer mutation - DELETE /mesh/explicit/{peer_id}
  const removeExplicitPeerMutation = useMutation({
    mutationFn: async (peerId: string) => {
      if (!endpoint) throw new Error('No endpoint configured');
      const res = await fetch(buildProxyUrl(endpoint, `/mesh/explicit/${peerId}`, port), {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error('Failed to remove explicit peer');
      return res.json();
    },
    onSuccess: () => {
      refetchMesh();
    },
  });

  // GRAFT peer to mesh - POST /mesh/{topic}/{peer_id}
  const graftPeerMutation = useMutation({
    mutationFn: async ({ topic, peerId }: { topic: string; peerId: string }) => {
      if (!endpoint) throw new Error('No endpoint configured');
      const encodedTopic = encodeURIComponent(topic);
      console.log('[Mesh] Grafting peer:', peerId, 'to topic:', topic);
      const url = buildProxyUrl(endpoint, `/mesh/${encodedTopic}/${peerId}`, port);
      console.log('[Mesh] URL:', url);
      const res = await fetch(url, {
        method: 'POST',
      });
      console.log('[Mesh] Response status:', res.status);
      if (!res.ok) {
        const errorText = await res.text();
        console.error('[Mesh] Error:', errorText);
        throw new Error(`Failed to graft peer: ${errorText}`);
      }
      const data = await res.json();
      console.log('[Mesh] Success:', data);
      return data;
    },
    onSuccess: () => {
      console.log('[Mesh] Graft success, refetching mesh...');
      alert('Peer grafted to mesh successfully!');
      refetchMesh();
    },
    onError: (error) => {
      console.error('[Mesh] Graft error:', error);
      alert(`Failed to graft peer: ${error.message}`);
    },
  });

  // PRUNE peer from mesh - DELETE /mesh/{topic}/{peer_id}
  const prunePeerMutation = useMutation({
    mutationFn: async ({ topic, peerId }: { topic: string; peerId: string }) => {
      if (!endpoint) throw new Error('No endpoint configured');
      const encodedTopic = encodeURIComponent(topic);
      const res = await fetch(buildProxyUrl(endpoint, `/mesh/${encodedTopic}/${peerId}`, port), {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error('Failed to prune peer');
      return res.json();
    },
    onSuccess: () => {
      refetchMesh();
    },
  });

  // Normalize peers data to Peer[] format
  const peers: Peer[] = useMemo(() => {
    const rawPeers = peersData || [];
    return rawPeers.map((p) => ({
      peer_id: p.peer_id ?? '',
      address: (p as Peer).address ?? '',
      direction: (p as Peer).direction ?? '',
      state: (p as Peer).state ?? 'unknown',
      rtt_ms: (p as Peer).rtt_ms ?? 0,
      best_rtt_ms: (p as Peer).best_rtt_ms ?? 0,
      rtt_verified: (p as Peer).rtt_verified ?? false,
      is_trusted: (p as Peer).is_trusted ?? false,
      score: (p as Peer).score ?? 0,
      peer_score: (p as Peer).peer_score ?? 0,
      gossipsub_score: (p as Peer).gossipsub_score ?? 0,
      gossipsub_score_weighted: (p as Peer).gossipsub_score_weighted ?? 0,
      client: (p as Peer).client ?? '',
    }));
  }, [peersData]);

  // Normalize mesh topics to MeshTopic[] format
  const meshTopics: MeshTopic[] = useMemo(() => {
    const rawMesh = meshData || [];
    return rawMesh.map((t) => ({
      topic: t.topic,
      kind: t.kind ?? 'unknown',
      peers: (t.peers || []).map((p) => ({
        peer_id: p.peer_id,
        client: p.client ?? '',
      })),
    }));
  }, [meshData]);

  // Normalize trusted peers to TrustedPeer[] format
  // Live data from collector may be strings or objects
  const trustedPeers: TrustedPeer[] = useMemo(() => {
    const rawTrusted = trustedPeersData || [];
    return rawTrusted.map((p) => {
      if (typeof p === 'string') {
        return { peer_id: p, enr: '', is_connected: false };
      }
      return {
        peer_id: p.peer_id,
        enr: (p as TrustedPeer).enr ?? '',
        is_connected: (p as TrustedPeer).is_connected ?? false,
      };
    });
  }, [trustedPeersData]);

  const bannedPeers = bannedPeersData || [];
  const firstBlockSenders = firstBlockSenderData || [];

  // Create a Set of all peer IDs currently in mesh for quick lookup
  const meshPeerIds = useMemo(() => {
    const ids = new Set<string>();
    meshTopics.forEach((topic) => {
      topic.peers.forEach((peer) => {
        ids.add(peer.peer_id);
      });
    });
    return ids;
  }, [meshTopics]);

  // Filter mesh topics based on search
  const filteredMeshTopics = useMemo(() => {
    if (!meshSearch) return meshTopics;
    const query = meshSearch.toLowerCase();
    return meshTopics.map((topic) => ({
      ...topic,
      peers: topic.peers.filter((peer) => {
        const clientInfo = parseClientInfo(peer.client);
        return (
          peer.peer_id.toLowerCase().includes(query) ||
          clientInfo.name.toLowerCase().includes(query)
        );
      }),
    })).filter((topic) => topic.peers.length > 0);
  }, [meshTopics, meshSearch]);

  // Filter first block senders based on search
  const filteredFirstBlockSenders = useMemo(() => {
    if (!statsSearch) return firstBlockSenders;
    const query = statsSearch.toLowerCase();
    return firstBlockSenders.filter((sender) =>
      sender.peer_id.toLowerCase().includes(query)
    );
  }, [firstBlockSenders, statsSearch]);

  // Get unique client names for filter dropdown
  const uniqueClients = useMemo(() => {
    const clients = new Set<string>();
    peers.forEach((peer) => {
      const clientInfo = parseClientInfo(peer.client);
      if (clientInfo.name) clients.add(clientInfo.name);
    });
    return Array.from(clients).sort();
  }, [peers]);

  // Filter and sort peers
  const filteredPeers = useMemo(() => {
    let result = [...peers];

    // Search filter
    if (peerSearch) {
      const query = peerSearch.toLowerCase();
      result = result.filter((peer) => {
        const clientInfo = parseClientInfo(peer.client);
        return (
          peer.peer_id.toLowerCase().includes(query) ||
          clientInfo.name.toLowerCase().includes(query) ||
          clientInfo.version.toLowerCase().includes(query)
        );
      });
    }

    // Trusted filter
    if (trustedFilter !== 'all') {
      const isTrusted = trustedFilter === 'trusted';
      result = result.filter((peer) => peer.is_trusted === isTrusted);
    }

    // Status filter
    if (statusFilter !== 'all') {
      result = result.filter((peer) => peer.state === statusFilter);
    }

    // Direction filter
    if (directionFilter !== 'all') {
      result = result.filter((peer) => peer.direction === directionFilter);
    }

    // Sort by score (highest first)
    return result.sort((a, b) => (b.score || 0) - (a.score || 0));
  }, [peers, peerSearch, trustedFilter, statusFilter, directionFilter]);

  // Filter trusted peers
  const filteredTrustedPeers = useMemo(() => {
    let result = [...trustedPeers];

    if (trustedSearch) {
      const query = trustedSearch.toLowerCase();
      result = result.filter((peer) =>
        peer.peer_id.toLowerCase().includes(query)
      );
    }

    if (trustedStatusFilter !== 'all') {
      const isConnected = trustedStatusFilter === 'connected';
      result = result.filter((peer) => peer.is_connected === isConnected);
    }

    return result;
  }, [trustedPeers, trustedSearch, trustedStatusFilter]);

  // Filter banned peers
  const filteredBannedPeers = useMemo(() => {
    let result = [...bannedPeers];

    if (bannedSearch) {
      const query = bannedSearch.toLowerCase();
      result = result.filter((peer) =>
        peer.peer_id.toLowerCase().includes(query)
      );
    }

    if (bannedTypeFilter !== 'all') {
      result = result.filter((peer) => peer.ban_type === bannedTypeFilter);
    }

    return result;
  }, [bannedPeers, bannedSearch, bannedTypeFilter]);

  const connectedPeers = peers.filter(p => p.state === 'connected');
  const inboundPeers = connectedPeers.filter(p => p.direction === 'inbound');
  const outboundPeers = connectedPeers.filter(p => p.direction === 'outbound');
  const avgRtt = connectedPeers.length > 0
    ? connectedPeers.reduce((sum, p) => sum + p.rtt_ms, 0) / connectedPeers.length
    : 0;

  // Calculate inbound percentage for health check
  const inboundPercent = connectedPeers.length > 0
    ? Math.round((inboundPeers.length / connectedPeers.length) * 100)
    : 0;

  if (!node.endpoint) {
    return (
      <Card className="h-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Server className="h-5 w-5" />
            {node.name}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <AlertCircle className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No IP address configured for this node.</p>
            <p className="text-sm text-muted-foreground mt-2">
              Configure an IP address in Relay Management to enable API access.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Node Header */}
      <div className="px-4 py-3 border-b flex-shrink-0">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-lg font-bold flex items-center gap-2">
              <Server className="h-4 w-4" />
              {node.name}
            </h2>
            <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
              <MapPin className="h-3 w-3" />
              {node.location || 'Unknown'}{node.country && `, ${node.country}`}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {node.tag && <Badge variant="secondary" className="text-xs">{node.tag}</Badge>}
            {/* Status badge - prioritize liveData.isOnline, fallback to healthStatus */}
            {(() => {
              // Use live data if available
              if (liveData) {
                return (
                  <Badge
                    variant="outline"
                    className={cn(
                      'text-xs',
                      liveData.isOnline ? 'text-green-600 border-green-200 bg-green-50' : 'text-red-600 border-red-200 bg-red-50'
                    )}
                  >
                    {liveData.isOnline ? 'online' : 'offline'}
                  </Badge>
                );
              }
              // Fallback to health check
              return (
                <Badge
                  variant="outline"
                  className={cn(
                    'text-xs',
                    healthStatus === 200 && 'text-green-600 border-green-200 bg-green-50',
                    healthStatus === 206 && 'text-yellow-600 border-yellow-200 bg-yellow-50',
                    (healthStatus === null || healthStatus === undefined) && 'text-red-600 border-red-200 bg-red-50'
                  )}
                >
                  {healthStatus === 200 ? 'active' : healthStatus === 206 ? 'syncing' : 'offline'}
                </Badge>
              );
            })()}
            {/* Open in popup button */}
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0"
              onClick={openPopup}
              title="Open in popup window"
            >
              <ExternalLink className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
        <p className="text-xs text-muted-foreground mt-1 font-mono">
          API: http://{endpoint}:{port}
        </p>
      </div>

      {/* Stats Summary */}
      <div className="grid grid-cols-5 gap-2 px-4 py-3 border-b bg-muted/30 flex-shrink-0">
        <div className="text-center">
          <p className="text-xl font-bold">{connectedPeers.length}</p>
          <p className="text-xs text-muted-foreground">Connected</p>
        </div>
        <div className="text-center">
          <TooltipProvider delayDuration={0}>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="cursor-help">
                  <p className={cn(
                    "text-xl font-bold",
                    inboundPercent >= 40 ? "text-green-600" : inboundPercent >= 10 ? "text-yellow-600" : "text-red-600"
                  )}>
                    {inboundPeers.length}/{outboundPeers.length}
                  </p>
                  <p className="text-xs text-muted-foreground">In/Out</p>
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <div className="text-xs space-y-1">
                  <p><strong>Inbound:</strong> {inboundPeers.length} ({inboundPercent}%)</p>
                  <p><strong>Outbound:</strong> {outboundPeers.length} ({100 - inboundPercent}%)</p>
                  <p className="pt-1 border-t mt-1">
                    {inboundPercent >= 40 ? "✅ Healthy - NAT is open" :
                     inboundPercent >= 10 ? "⚠️ Low inbound - check NAT/firewall" :
                     "❌ NAT/Firewall blocking inbound"}
                  </p>
                </div>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
        <div className="text-center">
          <p className="text-xl font-bold">{trustedPeers.length}</p>
          <p className="text-xs text-muted-foreground">Trusted</p>
        </div>
        <div className="text-center">
          <p className="text-xl font-bold">{avgRtt.toFixed(1)}</p>
          <p className="text-xs text-muted-foreground">Avg RTT (ms)</p>
        </div>
        <div className="text-center">
          <p className="text-xl font-bold">{discoveryData?.unique_peers_discovered || 0}</p>
          <p className="text-xs text-muted-foreground">Discovered</p>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="info" className="flex-1 flex flex-col min-h-0">
        <TabsList className="mx-4 mt-2 mb-0 flex-shrink-0">
          <TabsTrigger value="info" className="flex items-center gap-1">
            <Info className="h-3 w-3" />
            Info
          </TabsTrigger>
          <TabsTrigger value="peers" className="flex items-center gap-1">
            <Users className="h-3 w-3" />
            Peers
          </TabsTrigger>
          <TabsTrigger value="discovery" className="flex items-center gap-1">
            <Activity className="h-3 w-3" />
            Discovery
          </TabsTrigger>
          <TabsTrigger value="config" className="flex items-center gap-1">
            <Settings className="h-3 w-3" />
            Config
          </TabsTrigger>
          <TabsTrigger value="mesh" className="flex items-center gap-1">
            <Network className="h-3 w-3" />
            Mesh
          </TabsTrigger>
          <TabsTrigger value="banned" className="flex items-center gap-1">
            <Ban className="h-3 w-3" />
            Banned
            {bannedPeers.length > 0 && (
              <span className="ml-1 px-1.5 py-0.5 text-[10px] bg-red-100 text-red-600 rounded-full">
                {bannedPeers.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="stats" className="flex items-center gap-1">
            <BarChart3 className="h-3 w-3" />
            Stats
          </TabsTrigger>
        </TabsList>

        {/* Peers Tab */}
        <TabsContent value="peers" className="flex-1 flex flex-col min-h-0 mt-0 p-4 data-[state=inactive]:hidden">
          {/* Connect Peer Form */}
          <div className="space-y-2 mb-3">
            <div className="flex gap-2">
              <Input
                placeholder="ENR (enr:-IS4QH...)"
                value={connectEnr}
                onChange={(e) => setConnectEnr(e.target.value)}
                className="flex-1 h-8 text-xs"
              />
              <Button
                size="sm"
                onClick={() => connectPeerMutation.mutate({ enr: connectEnr })}
                disabled={!connectEnr || connectPeerMutation.isPending}
              >
                <Link2 className="h-3 w-3 mr-1" />
                Connect
              </Button>
            </div>
            <div className="flex gap-2">
              <Input
                placeholder="Multiaddr (/ip4/...)"
                value={connectMultiaddr}
                onChange={(e) => setConnectMultiaddr(e.target.value)}
                className="flex-1 h-8 text-xs"
              />
              <Button
                size="sm"
                onClick={() => connectPeerMutation.mutate({ multiaddr: connectMultiaddr })}
                disabled={!connectMultiaddr || connectPeerMutation.isPending}
              >
                <Link2 className="h-3 w-3 mr-1" />
                Connect
              </Button>
            </div>
          </div>

          {/* Search and Filter */}
          <div className="flex gap-2 mb-3">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-1/2 transform -translate-y-1/2 h-3 w-3 text-muted-foreground" />
              <Input
                placeholder="Search by ID, client..."
                value={peerSearch}
                onChange={(e) => setPeerSearch(e.target.value)}
                className="pl-8 h-8 text-xs"
              />
            </div>
            <Select value={trustedFilter} onValueChange={setTrustedFilter}>
              <SelectTrigger className="w-[100px] h-8 text-xs">
                <SelectValue placeholder="Trusted" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Peers</SelectItem>
                <SelectItem value="trusted">Trusted</SelectItem>
                <SelectItem value="untrusted">Untrusted</SelectItem>
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[100px] h-8 text-xs">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="connected">Connected</SelectItem>
                <SelectItem value="disconnected">Disconnected</SelectItem>
                <SelectItem value="connecting">Connecting</SelectItem>
              </SelectContent>
            </Select>
            <Select value={directionFilter} onValueChange={setDirectionFilter}>
              <SelectTrigger className="w-[100px] h-8 text-xs">
                <SelectValue placeholder="Direction" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Direction</SelectItem>
                <SelectItem value="inbound">Inbound</SelectItem>
                <SelectItem value="outbound">Outbound</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Peers List */}
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">
              Showing {filteredPeers.length} of {peers.length} peers ·
              <span className="text-green-600 ml-1">{inboundPeers.length} in</span>
              <span className="mx-1">/</span>
              <span className="text-blue-600">{outboundPeers.length} out</span>
            </span>
            <Button variant="ghost" size="sm" onClick={() => refetchPeers()}>
              <RefreshCw className={cn('h-3 w-3', peersLoading && 'animate-spin')} />
            </Button>
          </div>
          <div className="flex-1 border rounded-md overflow-y-auto min-h-0">
            {peersLoading ? (
              <div className="p-4 text-center text-muted-foreground">Loading...</div>
            ) : filteredPeers.length === 0 ? (
              <div className="p-4 text-center text-muted-foreground">
                {peers.length === 0 ? 'No peers found' : 'No peers match your filters'}
              </div>
            ) : (
              <Table>
                <TableHeader className="sticky top-0 bg-background z-10">
                  <TableRow>
                    <TableHead className="text-xs w-[100px]">Peer ID</TableHead>
                    <TableHead className="text-xs w-[90px]">Address</TableHead>
                    <TableHead className="text-xs w-[70px]">Status</TableHead>
                    <TableHead className="text-xs text-right w-[50px]">Score</TableHead>
                    <TableHead className="text-xs text-right w-[60px]">RTT</TableHead>
                    <TableHead className="text-xs w-[90px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredPeers.map((peer) => (
                      <TableRow key={peer.peer_id}>
                        {/* Peer ID */}
                        <TableCell className="text-xs font-mono py-2">
                          <TooltipProvider delayDuration={0}>
                            <Tooltip open={copiedPeerId === peer.peer_id ? true : undefined}>
                              <TooltipTrigger asChild>
                                <div
                                  className="flex items-center gap-1 cursor-pointer hover:bg-muted/50 rounded px-1 -mx-1 transition-colors"
                                  onClick={() => copyToClipboard(peer.peer_id)}
                                >
                                  {copiedPeerId === peer.peer_id ? (
                                    <Check className="h-3 w-3 text-green-500 flex-shrink-0" />
                                  ) : peer.is_trusted ? (
                                    <Shield className="h-3 w-3 text-blue-500 flex-shrink-0" />
                                  ) : (
                                    <Copy className="h-3 w-3 text-muted-foreground flex-shrink-0 opacity-50" />
                                  )}
                                  <span className="truncate">{peer.peer_id.slice(0, 4)}...{peer.peer_id.slice(-4)}</span>
                                </div>
                              </TooltipTrigger>
                              <TooltipContent>
                                {copiedPeerId === peer.peer_id ? (
                                  <p>Copied</p>
                                ) : (
                                  <p className="font-mono text-xs break-all max-w-[300px]">{peer.peer_id}</p>
                                )}
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </TableCell>
                        {/* Address */}
                        <TableCell className="text-xs font-mono py-2">
                          <TooltipProvider delayDuration={0}>
                            <Tooltip open={copiedPeerId === peer.address ? true : undefined}>
                              <TooltipTrigger asChild>
                                <div
                                  className="flex items-center gap-1 cursor-pointer hover:bg-muted/50 rounded px-1 -mx-1 transition-colors"
                                  onClick={() => copyToClipboard(peer.address)}
                                >
                                  {copiedPeerId === peer.address ? (
                                    <Check className="h-3 w-3 text-green-500 flex-shrink-0" />
                                  ) : (
                                    <Copy className="h-3 w-3 text-muted-foreground flex-shrink-0 opacity-50" />
                                  )}
                                  <span className="truncate text-muted-foreground">{peer.address.slice(0, 10)}...</span>
                                </div>
                              </TooltipTrigger>
                              <TooltipContent>
                                {copiedPeerId === peer.address ? (
                                  <p>Copied!</p>
                                ) : (
                                  <p className="font-mono text-xs break-all max-w-[350px]">{peer.address}</p>
                                )}
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </TableCell>
                        {/* Status + Direction */}
                        <TableCell className="text-xs py-2">
                          <div className="flex items-center gap-1">
                            <Badge
                              variant="outline"
                              className={cn(
                                'text-[10px] px-1.5 py-0',
                                peer.state === 'connected' && 'text-green-600 border-green-200 bg-green-50',
                                peer.state === 'disconnected' && 'text-gray-500 border-gray-200 bg-gray-50',
                                peer.state === 'connecting' && 'text-yellow-600 border-yellow-200 bg-yellow-50'
                              )}
                            >
                              {peer.state}
                            </Badge>
                            <Badge
                              variant="outline"
                              className={cn(
                                'text-[10px] px-1 py-0',
                                peer.direction === 'inbound' && 'text-green-600 border-green-200 bg-green-50',
                                peer.direction === 'outbound' && 'text-blue-600 border-blue-200 bg-blue-50'
                              )}
                            >
                              {peer.direction === 'inbound' ? '↓in' : '↑out'}
                            </Badge>
                          </div>
                        </TableCell>
                        {/* Score */}
                        <TableCell className="text-xs text-right py-2">
                          <TooltipProvider delayDuration={0}>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span className={cn(
                                  'font-mono cursor-help',
                                  peer.score > 0 && 'text-green-600',
                                  peer.score === 0 && 'text-gray-500',
                                  peer.score < 0 && peer.score > -20 && 'text-yellow-600',
                                  peer.score <= -20 && peer.score > -50 && 'text-orange-600',
                                  peer.score <= -50 && 'text-red-600'
                                )}>
                                  {peer.score?.toFixed(2) || '0'}
                                </span>
                              </TooltipTrigger>
                              <TooltipContent className="max-w-xs">
                                <div className="text-xs space-y-2">
                                  <p className="font-medium border-b pb-1">Score Breakdown</p>
                                  <div className="space-y-1">
                                    <p><span className="text-muted-foreground">peer_score:</span> <span className="font-mono">{peer.peer_score?.toFixed(2) || '0'}</span></p>
                                    <p><span className="text-muted-foreground">gossipsub_score:</span> <span className="font-mono">{peer.gossipsub_score?.toFixed(2) || '0'}</span></p>
                                    <p><span className="text-muted-foreground">gossipsub_weighted:</span> <span className="font-mono">{peer.gossipsub_score_weighted?.toFixed(2) || '0'}</span></p>
                                  </div>
                                  <div className="border-t pt-1 text-muted-foreground">
                                    <p className="font-mono text-[10px]">score = peer_score + gossipsub_weighted</p>
                                    <p className="font-mono text-[10px]">{peer.score?.toFixed(2)} = {peer.peer_score?.toFixed(2)} + ({peer.gossipsub_score_weighted?.toFixed(2)})</p>
                                  </div>
                                </div>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </TableCell>
                        {/* RTT */}
                        <TableCell className="text-xs text-right py-2 font-mono">
                          <TooltipProvider delayDuration={0}>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span className={cn(
                                  'cursor-help',
                                  peer.rtt_ms < 50 && 'text-green-600',
                                  peer.rtt_ms >= 50 && peer.rtt_ms < 100 && 'text-yellow-600',
                                  peer.rtt_ms >= 100 && 'text-orange-600'
                                )}>
                                  {peer.rtt_ms?.toFixed(0) || '-'}
                                </span>
                              </TooltipTrigger>
                              <TooltipContent>
                                <div className="text-xs space-y-1">
                                  <p><span className="text-muted-foreground">Current:</span> {peer.rtt_ms?.toFixed(2) || '-'} ms</p>
                                  <p><span className="text-muted-foreground">Best:</span> {peer.best_rtt_ms?.toFixed(2) || '-'} ms</p>
                                  <p><span className="text-muted-foreground">Verified:</span> {peer.rtt_verified ? 'Yes' : 'No'}</p>
                                </div>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </TableCell>
                        {/* Actions */}
                        <TableCell className="py-2">
                          <div className="flex items-center gap-0.5">
                            {peer.state === 'connected' && (
                              <TooltipProvider delayDuration={0}>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <span className="inline-flex">
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-6 w-6 p-0"
                                        onClick={() => !peer.is_trusted && trustPeerMutation.mutate(peer.peer_id)}
                                        disabled={peer.is_trusted || trustPeerMutation.isPending}
                                      >
                                        <Shield className={cn(
                                          "h-3 w-3",
                                          peer.is_trusted ? "text-gray-300" : "text-blue-500"
                                        )} />
                                      </Button>
                                    </span>
                                  </TooltipTrigger>
                                  <TooltipContent>{peer.is_trusted ? 'Already trusted' : 'Trust'}</TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            )}
                            {peer.state === 'connected' && (
                              <TooltipProvider delayDuration={0}>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-6 w-6 p-0"
                                      onClick={() => disconnectPeerMutation.mutate(peer.peer_id)}
                                    >
                                      <Unlink className="h-3 w-3 text-red-500" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>Disconnect</TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            )}
                            <TooltipProvider delayDuration={0}>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-6 w-6 p-0"
                                    onClick={() => banPeerMutation.mutate(peer.peer_id)}
                                    disabled={banPeerMutation.isPending}
                                  >
                                    <Ban className="h-3 w-3 text-orange-500" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>Ban</TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                            {peer.state === 'connected' && meshTopics.length > 0 && (
                              <TooltipProvider delayDuration={0}>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-6 w-6 p-0"
                                      onClick={() => setGraftPeerId(peer.peer_id)}
                                    >
                                      <GitMerge className="h-3 w-3 text-purple-500" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>Add to mesh</TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                </TableBody>
              </Table>
            )}
          </div>

          {/* Graft to Mesh Dialog */}
          {graftPeerId && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setGraftPeerId(null)}>
              <Card className="w-[400px] max-h-[500px]" onClick={(e) => e.stopPropagation()}>
                <CardHeader className="py-3 px-4">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <GitMerge className="h-4 w-4 text-purple-500" />
                    Add to Mesh
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Select a topic to GRAFT peer into mesh
                  </CardDescription>
                </CardHeader>
                <CardContent className="px-4 pb-4">
                  <p className="text-xs text-muted-foreground mb-2">
                    Peer: <code className="bg-muted px-1 rounded">{graftPeerId.slice(0, 8)}...{graftPeerId.slice(-8)}</code>
                  </p>
                  <div className="space-y-2 max-h-[300px] overflow-y-auto">
                    {meshTopics.map((topic) => (
                      <Button
                        key={topic.topic}
                        variant="outline"
                        size="sm"
                        className="w-full justify-start text-left h-auto py-2"
                        onClick={() => {
                          graftPeerMutation.mutate({ topic: topic.topic, peerId: graftPeerId });
                          setGraftPeerId(null);
                        }}
                        disabled={graftPeerMutation.isPending}
                      >
                        <div className="flex flex-col items-start">
                          <div className="flex items-center gap-2">
                            <Badge variant="secondary" className="text-[10px]">{topic.kind}</Badge>
                            <span className="text-xs">{topic.peers.length} peers</span>
                          </div>
                          <span className="text-[10px] text-muted-foreground truncate max-w-[350px]">
                            {topic.topic}
                          </span>
                        </div>
                      </Button>
                    ))}
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full mt-3"
                    onClick={() => setGraftPeerId(null)}
                  >
                    Cancel
                  </Button>
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>


        {/* Discovery Tab */}
        <TabsContent value="discovery" className="flex-1 mt-0 p-4 overflow-y-auto data-[state=inactive]:hidden">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium">Discovery Statistics</span>
            <Button variant="ghost" size="sm" onClick={() => refetchDiscovery()}>
              <RefreshCw className={cn('h-3 w-3', discoveryLoading && 'animate-spin')} />
            </Button>
          </div>
          {discoveryLoading ? (
            <div className="p-4 text-center text-muted-foreground">Loading...</div>
          ) : !discoveryData ? (
            <div className="p-4 text-center text-muted-foreground">No discovery data</div>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              <Card>
                <CardContent className="p-3">
                  <p className="text-2xl font-bold">{discoveryData.unique_peers_discovered}</p>
                  <p className="text-xs text-muted-foreground">Unique Peers Discovered</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-3">
                  <p className="text-2xl font-bold">{discoveryData.total_discovery_queries}</p>
                  <p className="text-xs text-muted-foreground">Total Queries</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-3">
                  <p className="text-2xl font-bold">{discoveryData.routing_table_size}</p>
                  <p className="text-xs text-muted-foreground">Routing Table Size</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-3">
                  <p className="text-2xl font-bold">{discoveryData.cached_enrs}</p>
                  <p className="text-xs text-muted-foreground">Cached ENRs</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-3">
                  <p className="text-2xl font-bold">{discoveryData.kademlia_k}</p>
                  <p className="text-xs text-muted-foreground">Kademlia K</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-3">
                  <p className="text-2xl font-bold">{discoveryData.target_peers_per_query}</p>
                  <p className="text-xs text-muted-foreground">Target Peers/Query</p>
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>

        {/* Config Tab */}
        <TabsContent value="config" className="flex-1 mt-0 p-4 overflow-y-auto data-[state=inactive]:hidden">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium">Runtime Configuration</span>
            <Button variant="ghost" size="sm" onClick={() => refetchConfig()}>
              <RefreshCw className={cn('h-3 w-3', configLoading && 'animate-spin')} />
            </Button>
          </div>

          {/* Current Config Display */}
          {configData && (
            <div className="grid grid-cols-5 gap-2 mb-4">
              <Card>
                <CardContent className="p-3">
                  <p className="text-2xl font-bold">{configData.target_peers}</p>
                  <p className="text-xs text-muted-foreground">Target Peers</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-3">
                  <p className="text-2xl font-bold">{configData.max_latency_ms}</p>
                  <p className="text-xs text-muted-foreground">Max Latency (ms)</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-3">
                  <TooltipProvider delayDuration={0}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className="cursor-help">
                          <p className="text-2xl font-bold">{configData.network_load}</p>
                          <p className="text-xs text-muted-foreground">
                            {networkLoadLevels[configData.network_load]?.name || 'Unknown'}
                          </p>
                        </div>
                      </TooltipTrigger>
                      <TooltipContent>
                        <div className="text-xs space-y-1">
                          <p className="font-medium">Network Load Level {configData.network_load}</p>
                          <p>mesh_n: {networkLoadLevels[configData.network_load]?.mesh_n || '-'}</p>
                          <p>heartbeat: {networkLoadLevels[configData.network_load]?.heartbeat || '-'}</p>
                        </div>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-3">
                  <p className="text-2xl font-bold">{configData.heartbeat_interval_ms}</p>
                  <p className="text-xs text-muted-foreground">Heartbeat (ms)</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-3">
                  <p className="text-2xl font-bold">{configData.discovery_interval_ms}</p>
                  <p className="text-xs text-muted-foreground">Discovery (ms)</p>
                </CardContent>
              </Card>
            </div>
          )}

          <div className="space-y-4">
            {/* Target Peers */}
            <div>
              <label className="text-sm font-medium">Target Peer Count</label>
              <p className="text-xs text-muted-foreground mb-2">
                Set the target number of peers to maintain
              </p>
              <div className="flex gap-2">
                <Input
                  type="number"
                  placeholder={configData ? `Current: ${configData.target_peers}` : 'e.g., 100'}
                  value={targetPeers}
                  onChange={(e) => setTargetPeers(e.target.value)}
                  className="flex-1 h-9"
                />
                <Button
                  onClick={() => {
                    const parsedValue = parseInt(targetPeers);
                    console.log('[Config UI] Target Peers button clicked');
                    console.log('[Config UI] Value:', targetPeers, 'Parsed:', parsedValue, 'isNaN:', isNaN(parsedValue));
                    console.log('[Config UI] Endpoint:', endpoint, 'Port:', port);
                    console.log('[Config UI] Mutation pending:', updateConfigMutation.isPending);
                    if (!endpoint) {
                      alert('No endpoint configured for this node');
                      return;
                    }
                    if (isNaN(parsedValue)) {
                      alert('Please enter a valid number');
                      return;
                    }
                    console.log('[Config UI] Calling mutation with target_peers:', parsedValue);
                    updateConfigMutation.mutate({ target_peers: parsedValue });
                  }}
                  disabled={!targetPeers || updateConfigMutation.isPending}
                >
                  {updateConfigMutation.isPending ? 'Setting...' : 'Set'}
                </Button>
              </div>
            </div>

            {/* Max Latency */}
            <div>
              <label className="text-sm font-medium">Max Latency Threshold (ms)</label>
              <p className="text-xs text-muted-foreground mb-2">
                Set the maximum acceptable peer latency
              </p>
              <div className="flex gap-2">
                <Input
                  type="number"
                  step="0.1"
                  placeholder={configData ? `Current: ${configData.max_latency_ms}` : 'e.g., 150.0'}
                  value={maxLatency}
                  onChange={(e) => setMaxLatency(e.target.value)}
                  className="flex-1 h-9"
                />
                <Button
                  onClick={() => {
                    const parsedValue = parseFloat(maxLatency);
                    console.log('[Config UI] Max Latency button clicked');
                    console.log('[Config UI] Value:', maxLatency, 'Parsed:', parsedValue, 'isNaN:', isNaN(parsedValue));
                    console.log('[Config UI] Endpoint:', endpoint, 'Port:', port);
                    console.log('[Config UI] Mutation pending:', updateConfigMutation.isPending);
                    if (!endpoint) {
                      alert('No endpoint configured for this node');
                      return;
                    }
                    if (isNaN(parsedValue)) {
                      alert('Please enter a valid number');
                      return;
                    }
                    console.log('[Config UI] Calling mutation with max_latency_ms:', parsedValue);
                    updateConfigMutation.mutate({ max_latency_ms: parsedValue });
                  }}
                  disabled={!maxLatency || updateConfigMutation.isPending}
                >
                  {updateConfigMutation.isPending ? 'Setting...' : 'Set'}
                </Button>
              </div>
            </div>

            {/* Network Load */}
            <div>
              <label className="text-sm font-medium">Network Load Level (1-40)</label>
              <p className="text-xs text-muted-foreground mb-2">
                Controls gossipsub mesh size and heartbeat interval. <span className="text-green-600 font-medium">Takes effect immediately.</span>
              </p>
              <div className="flex gap-2">
                <Select
                  value={networkLoad}
                  onValueChange={setNetworkLoad}
                >
                  <SelectTrigger className="flex-1 h-9">
                    <SelectValue placeholder={configData ? `Current: ${configData.network_load} (${networkLoadLevels[configData.network_load]?.name})` : 'Select level'} />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(networkLoadLevels).map(([level, info]) => (
                      <SelectItem key={level} value={level}>
                        <span className="flex items-center gap-2">
                          <span className="font-mono">{level}</span>
                          <span className="text-muted-foreground">-</span>
                          <span>{info.name}</span>
                          <span className="text-muted-foreground text-xs">(mesh_n: {info.mesh_n})</span>
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  onClick={() => {
                    const parsedValue = parseInt(networkLoad);
                    console.log('[Config UI] Network Load button clicked');
                    console.log('[Config UI] Value:', networkLoad, 'Parsed:', parsedValue, 'isNaN:', isNaN(parsedValue));
                    console.log('[Config UI] Endpoint:', endpoint, 'Port:', port);
                    console.log('[Config UI] Mutation pending:', updateConfigMutation.isPending);
                    if (!endpoint) {
                      alert('No endpoint configured for this node');
                      return;
                    }
                    if (isNaN(parsedValue)) {
                      alert('Please select a valid network load level');
                      return;
                    }
                    console.log('[Config UI] Calling mutation with network_load:', parsedValue);
                    updateConfigMutation.mutate({ network_load: parsedValue });
                  }}
                  disabled={!networkLoad || updateConfigMutation.isPending}
                >
                  {updateConfigMutation.isPending ? 'Setting...' : 'Set'}
                </Button>
              </div>
            </div>

            {/* Heartbeat Interval */}
            <div>
              <label className="text-sm font-medium">Heartbeat Interval (ms)</label>
              <p className="text-xs text-muted-foreground mb-2">
                Gossipsub heartbeat interval in milliseconds. Controls mesh maintenance frequency. <span className="text-green-600 font-medium">Takes effect immediately.</span>
              </p>
              <div className="flex gap-2">
                <Input
                  type="number"
                  placeholder={configData ? `Current: ${configData.heartbeat_interval_ms}` : 'e.g., 1000'}
                  value={heartbeatInterval}
                  onChange={(e) => setHeartbeatInterval(e.target.value)}
                  className="flex-1 h-9"
                />
                <Button
                  onClick={() => {
                    const parsedValue = parseInt(heartbeatInterval);
                    console.log('[Config UI] Heartbeat Interval button clicked');
                    console.log('[Config UI] Value:', heartbeatInterval, 'Parsed:', parsedValue, 'isNaN:', isNaN(parsedValue));
                    if (!endpoint) {
                      alert('No endpoint configured for this node');
                      return;
                    }
                    if (isNaN(parsedValue) || parsedValue < 100 || parsedValue > 5000) {
                      alert('Please enter a valid interval (100-5000ms)');
                      return;
                    }
                    console.log('[Config UI] Calling mutation with heartbeat_interval_ms:', parsedValue);
                    updateConfigMutation.mutate({ heartbeat_interval_ms: parsedValue });
                  }}
                  disabled={!heartbeatInterval || updateConfigMutation.isPending}
                >
                  {updateConfigMutation.isPending ? 'Setting...' : 'Set'}
                </Button>
              </div>
            </div>

            {/* Discovery Interval */}
            <div>
              <label className="text-sm font-medium">Discovery Interval (ms)</label>
              <p className="text-xs text-muted-foreground mb-2">
                Peer manager heartbeat interval. Controls discovery and peer pruning frequency. <span className="text-green-600 font-medium">Takes effect immediately.</span>
              </p>
              <div className="flex gap-2">
                <Input
                  type="number"
                  placeholder={configData ? `Current: ${configData.discovery_interval_ms}` : 'e.g., 2000'}
                  value={discoveryInterval}
                  onChange={(e) => setDiscoveryInterval(e.target.value)}
                  className="flex-1 h-9"
                />
                <Button
                  onClick={() => {
                    const parsedValue = parseInt(discoveryInterval);
                    console.log('[Config UI] Discovery Interval button clicked');
                    console.log('[Config UI] Value:', discoveryInterval, 'Parsed:', parsedValue, 'isNaN:', isNaN(parsedValue));
                    if (!endpoint) {
                      alert('No endpoint configured for this node');
                      return;
                    }
                    if (isNaN(parsedValue) || parsedValue < 500 || parsedValue > 10000) {
                      alert('Please enter a valid interval (500-10000ms)');
                      return;
                    }
                    console.log('[Config UI] Calling mutation with discovery_interval_ms:', parsedValue);
                    updateConfigMutation.mutate({ discovery_interval_ms: parsedValue });
                  }}
                  disabled={!discoveryInterval || updateConfigMutation.isPending}
                >
                  {updateConfigMutation.isPending ? 'Setting...' : 'Set'}
                </Button>
              </div>
            </div>
          </div>
        </TabsContent>

        {/* Node Info Tab */}
        <TabsContent value="info" className="flex-1 mt-0 p-4 overflow-y-auto data-[state=inactive]:hidden">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium">Node Information</span>
            <Button variant="ghost" size="sm" onClick={() => refetchNodeInfo()}>
              <RefreshCw className={cn('h-3 w-3', nodeInfoLoading && 'animate-spin')} />
            </Button>
          </div>
          {nodeInfoLoading ? (
            <div className="p-4 text-center text-muted-foreground">Loading...</div>
          ) : !nodeInfoData ? (
            <div className="p-4 text-center text-muted-foreground">No node info available</div>
          ) : (
            <div className="space-y-4">
              {/* Peer ID */}
              <Card>
                <CardHeader className="py-3 px-4">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Hash className="h-4 w-4" />
                    Peer ID
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-4 pb-3 pt-0">
                  <div className="flex items-center gap-2">
                    <code className="text-xs bg-muted px-2 py-1 rounded break-all flex-1">
                      {nodeInfoData.peer_id}
                    </code>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0 flex-shrink-0"
                      onClick={() => copyToClipboard(nodeInfoData.peer_id)}
                    >
                      {copiedPeerId === nodeInfoData.peer_id ? (
                        <Check className="h-3 w-3 text-green-500" />
                      ) : (
                        <Copy className="h-3 w-3" />
                      )}
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* ENR */}
              <Card>
                <CardHeader className="py-3 px-4">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Network className="h-4 w-4" />
                    ENR (Ethereum Node Record)
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-4 pb-3 pt-0">
                  <div className="flex items-start gap-2">
                    <code className="text-xs bg-muted px-2 py-1 rounded break-all flex-1 max-h-20 overflow-y-auto">
                      {nodeInfoData.enr}
                    </code>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0 flex-shrink-0"
                      onClick={() => copyToClipboard(nodeInfoData.enr)}
                    >
                      {copiedPeerId === nodeInfoData.enr ? (
                        <Check className="h-3 w-3 text-green-500" />
                      ) : (
                        <Copy className="h-3 w-3" />
                      )}
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* P2P Addresses */}
              <Card>
                <CardHeader className="py-3 px-4">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Wifi className="h-4 w-4" />
                    P2P Addresses (TCP)
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-4 pb-3 pt-0 space-y-2">
                  {nodeInfoData.p2p_addresses.length === 0 ? (
                    <p className="text-xs text-muted-foreground">No P2P addresses</p>
                  ) : (
                    nodeInfoData.p2p_addresses.map((addr, idx) => (
                      <div key={idx} className="flex items-center gap-2">
                        <code className="text-xs bg-muted px-2 py-1 rounded break-all flex-1">
                          {addr}
                        </code>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0 flex-shrink-0"
                          onClick={() => copyToClipboard(addr)}
                        >
                          {copiedPeerId === addr ? (
                            <Check className="h-3 w-3 text-green-500" />
                          ) : (
                            <Copy className="h-3 w-3" />
                          )}
                        </Button>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>

              {/* Discovery Addresses */}
              <Card>
                <CardHeader className="py-3 px-4">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Activity className="h-4 w-4" />
                    Discovery Addresses (UDP)
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-4 pb-3 pt-0 space-y-2">
                  {nodeInfoData.discovery_addresses.length === 0 ? (
                    <p className="text-xs text-muted-foreground">No discovery addresses</p>
                  ) : (
                    nodeInfoData.discovery_addresses.map((addr, idx) => (
                      <div key={idx} className="flex items-center gap-2">
                        <code className="text-xs bg-muted px-2 py-1 rounded break-all flex-1">
                          {addr}
                        </code>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0 flex-shrink-0"
                          onClick={() => copyToClipboard(addr)}
                        >
                          {copiedPeerId === addr ? (
                            <Check className="h-3 w-3 text-green-500" />
                          ) : (
                            <Copy className="h-3 w-3" />
                          )}
                        </Button>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>

              {/* Metadata */}
              <Card>
                <CardHeader className="py-3 px-4">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Settings className="h-4 w-4" />
                    Metadata
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-4 pb-3 pt-0">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <p className="text-xs text-muted-foreground">Sequence Number</p>
                      <p className="text-sm font-mono">{nodeInfoData.metadata.seq_number}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Custody Groups</p>
                      <p className="text-sm font-mono">{nodeInfoData.metadata.custody_group_count}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Attestation Subnets</p>
                      <code className="text-xs bg-muted px-1.5 py-0.5 rounded">
                        {nodeInfoData.metadata.attnets}
                      </code>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Sync Committee Subnets</p>
                      <code className="text-xs bg-muted px-1.5 py-0.5 rounded">
                        {nodeInfoData.metadata.syncnets}
                      </code>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>

        {/* Mesh Tab */}
        <TabsContent value="mesh" className="flex-1 flex flex-col min-h-0 mt-0 p-4 data-[state=inactive]:hidden">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium">Gossipsub Mesh</span>
            <Button variant="ghost" size="sm" onClick={() => refetchMesh()}>
              <RefreshCw className={cn('h-3 w-3', meshLoading && 'animate-spin')} />
            </Button>
          </div>

          {/* Mesh Search */}
          <div className="flex gap-2 mb-3">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-1/2 transform -translate-y-1/2 h-3 w-3 text-muted-foreground" />
              <Input
                placeholder="Search by peer ID, client..."
                value={meshSearch}
                onChange={(e) => setMeshSearch(e.target.value)}
                className="pl-8 h-8 text-xs"
              />
            </div>
            <span className="text-xs text-muted-foreground flex items-center">
              {meshPeerIds.size} unique peers in mesh
            </span>
          </div>

          <div className="flex-1 overflow-y-auto min-h-0">
            {meshLoading ? (
              <div className="p-4 text-center text-muted-foreground">Loading...</div>
            ) : filteredMeshTopics.length === 0 ? (
              <div className="p-4 text-center text-muted-foreground">
                {meshTopics.length === 0 ? 'No mesh data available' : 'No peers match your search'}
              </div>
            ) : (
              <div className="space-y-3">
                {filteredMeshTopics.map((topic) => (
                <Card key={topic.topic}>
                  <CardHeader className="py-2 px-3">
                    <CardTitle className="text-xs font-medium flex items-center justify-between">
                      <span className="flex items-center gap-2">
                        <Badge variant="secondary" className="text-[10px]">
                          {topic.kind}
                        </Badge>
                        <span className="text-muted-foreground font-normal truncate max-w-[250px]" title={topic.topic}>
                          {topic.topic.split('/').slice(-2).join('/')}
                        </span>
                      </span>
                      <Badge variant="outline" className="text-[10px]">
                        {topic.peers.length} peers
                      </Badge>
                    </CardTitle>
                  </CardHeader>
                  {topic.peers.length > 0 && (
                    <CardContent className="py-2 px-3">
                      <div className="space-y-1">
                        {topic.peers.map((peer) => {
                          const clientInfo = parseClientInfo(peer.client);
                          return (
                            <div key={peer.peer_id} className="flex items-center justify-between text-xs py-1 px-2 bg-muted/50 rounded">
                              <div className="flex items-center gap-2">
                                <TooltipProvider delayDuration={0}>
                                  <Tooltip open={copiedPeerId === peer.peer_id ? true : undefined}>
                                    <TooltipTrigger asChild>
                                      <span
                                        className="font-mono cursor-pointer hover:text-blue-600 flex items-center gap-1"
                                        onClick={() => copyToClipboard(peer.peer_id)}
                                      >
                                        {copiedPeerId === peer.peer_id ? (
                                          <Check className="h-3 w-3 text-green-500" />
                                        ) : (
                                          <Copy className="h-3 w-3 text-muted-foreground opacity-50" />
                                        )}
                                        {peer.peer_id.slice(0, 4)}...{peer.peer_id.slice(-4)}
                                      </span>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                      {copiedPeerId === peer.peer_id ? (
                                        <p>Copied!</p>
                                      ) : (
                                        <p className="font-mono text-xs">{peer.peer_id}</p>
                                      )}
                                    </TooltipContent>
                                  </Tooltip>
                                </TooltipProvider>
                                <Badge variant="secondary" className="text-[10px]">
                                  {clientInfo.name}
                                </Badge>
                              </div>
                              <div className="flex items-center gap-1">
                                <TooltipProvider delayDuration={0}>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-5 w-5 p-0"
                                        onClick={() => addExplicitPeerMutation.mutate(peer.peer_id)}
                                        disabled={addExplicitPeerMutation.isPending}
                                      >
                                        <Plus className="h-3 w-3 text-green-500" />
                                      </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>Add to explicit</TooltipContent>
                                  </Tooltip>
                                </TooltipProvider>
                                <TooltipProvider delayDuration={0}>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-5 w-5 p-0"
                                        onClick={() => prunePeerMutation.mutate({ topic: topic.topic, peerId: peer.peer_id })}
                                        disabled={prunePeerMutation.isPending}
                                      >
                                        <Minus className="h-3 w-3 text-red-500" />
                                      </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>Prune from mesh</TooltipContent>
                                  </Tooltip>
                                </TooltipProvider>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </CardContent>
                  )}
                </Card>
              ))}
              </div>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-3 flex-shrink-0">
            <strong>Note:</strong> Explicit peers are always included in the mesh regardless of their score.
          </p>
        </TabsContent>

        {/* Banned Peers Tab */}
        <TabsContent value="banned" className="flex-1 flex flex-col min-h-0 mt-0 p-4 data-[state=inactive]:hidden">
          {/* Ban Peer Form */}
          <div className="flex gap-2 mb-3">
            <Input
              placeholder="Peer ID (16Uiu2HAm...)"
              value={banPeerId}
              onChange={(e) => setBanPeerId(e.target.value)}
              className="flex-1 h-8 text-xs font-mono"
            />
            <Button
              size="sm"
              variant="destructive"
              onClick={() => {
                banPeerMutation.mutate(banPeerId);
                setBanPeerId('');
              }}
              disabled={!banPeerId || banPeerMutation.isPending}
            >
              <Ban className="h-3 w-3 mr-1" />
              Ban
            </Button>
          </div>

          {/* Search and Filter */}
          <div className="flex gap-2 mb-3">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-1/2 transform -translate-y-1/2 h-3 w-3 text-muted-foreground" />
              <Input
                placeholder="Search by Peer ID..."
                value={bannedSearch}
                onChange={(e) => setBannedSearch(e.target.value)}
                className="pl-8 h-8 text-xs"
              />
            </div>
            <Select value={bannedTypeFilter} onValueChange={setBannedTypeFilter}>
              <SelectTrigger className="w-[130px] h-8 text-xs">
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="permanent">Permanent</SelectItem>
                <SelectItem value="temporary">Temporary</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Banned Peers List */}
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">
              Showing {filteredBannedPeers.length} of {bannedPeers.length} banned peers
            </span>
            <Button variant="ghost" size="sm" onClick={() => refetchBanned()}>
              <RefreshCw className={cn('h-3 w-3', bannedLoading && 'animate-spin')} />
            </Button>
          </div>
          <div className="flex-1 overflow-y-auto border rounded-md min-h-0">
            {bannedLoading ? (
              <div className="p-4 text-center text-muted-foreground">Loading...</div>
            ) : filteredBannedPeers.length === 0 ? (
              <div className="p-4 text-center text-muted-foreground">
                {bannedPeers.length === 0 ? 'No banned peers' : 'No peers match your filters'}
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">Peer ID</TableHead>
                    <TableHead className="text-xs">Ban Type</TableHead>
                    <TableHead className="text-xs w-10"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredBannedPeers.map((peer) => (
                    <TableRow key={peer.peer_id}>
                      <TableCell className="text-xs font-mono">
                        <TooltipProvider delayDuration={0}>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div
                                className="flex items-center gap-1 cursor-pointer hover:bg-muted/50 rounded px-1 -mx-1 transition-colors"
                                onClick={() => copyToClipboard(peer.peer_id)}
                              >
                                {copiedPeerId === peer.peer_id ? (
                                  <Check className="h-3 w-3 text-green-500 flex-shrink-0" />
                                ) : (
                                  <Copy className="h-3 w-3 text-muted-foreground flex-shrink-0 opacity-50" />
                                )}
                                <span className="truncate">{peer.peer_id.slice(0, 16)}...</span>
                              </div>
                            </TooltipTrigger>
                            <TooltipContent>
                              {copiedPeerId === peer.peer_id ? (
                                <p>Copied!</p>
                              ) : (
                                <p className="font-mono text-xs break-all max-w-[300px]">{peer.peer_id}</p>
                              )}
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={cn(
                            'text-xs',
                            peer.ban_type === 'permanent' && 'text-red-600 border-red-200 bg-red-50',
                            peer.ban_type === 'temporary' && 'text-yellow-600 border-yellow-200 bg-yellow-50'
                          )}
                        >
                          {peer.ban_type}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {peer.ban_type === 'permanent' && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0"
                            onClick={() => unbanPeerMutation.mutate(peer.peer_id)}
                            disabled={unbanPeerMutation.isPending}
                          >
                            <ShieldOff className="h-3 w-3 text-green-500" />
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            <strong>Note:</strong> Temporary bans auto-expire after ~30 minutes. Only permanent bans can be manually removed.
          </p>
        </TabsContent>

        {/* Stats Tab */}
        <TabsContent value="stats" className="flex-1 flex flex-col min-h-0 mt-0 p-4 data-[state=inactive]:hidden">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium">First Block Senders</span>
            <Button variant="ghost" size="sm" onClick={() => refetchFirstBlockSender()}>
              <RefreshCw className={cn('h-3 w-3', firstBlockSenderLoading && 'animate-spin')} />
            </Button>
          </div>

          {/* Stats Search */}
          <div className="flex gap-2 mb-3">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-1/2 transform -translate-y-1/2 h-3 w-3 text-muted-foreground" />
              <Input
                placeholder="Search by peer ID..."
                value={statsSearch}
                onChange={(e) => setStatsSearch(e.target.value)}
                className="pl-8 h-8 text-xs"
              />
            </div>
            <span className="text-xs text-muted-foreground flex items-center gap-2">
              {filteredFirstBlockSenders.filter(s => meshPeerIds.has(s.peer_id)).length}/{filteredFirstBlockSenders.length} in mesh
            </span>
          </div>

          <p className="text-xs text-muted-foreground mb-3">
            Peers ranked by how often they send us new blocks first. Higher count means better propagation source.
          </p>
          <div className="flex-1 overflow-y-auto border rounded-md min-h-0">
            {firstBlockSenderLoading ? (
              <div className="p-4 text-center text-muted-foreground">Loading...</div>
            ) : filteredFirstBlockSenders.length === 0 ? (
              <div className="p-4 text-center text-muted-foreground">
                {firstBlockSenders.length === 0 ? 'No first block sender stats available yet' : 'No peers match your search'}
              </div>
            ) : (
              <Table>
                <TableHeader className="sticky top-0 bg-background z-10">
                  <TableRow>
                    <TableHead className="text-xs w-[50px]">#</TableHead>
                    <TableHead className="text-xs">Peer ID</TableHead>
                    <TableHead className="text-xs w-[60px]">Mesh</TableHead>
                    <TableHead className="text-xs text-right w-[80px]">Count</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredFirstBlockSenders.map((sender, index) => {
                    const totalCount = firstBlockSenders.reduce((sum, s) => sum + s.count, 0);
                    const percentage = totalCount > 0 ? (sender.count / totalCount * 100) : 0;
                    const isInMesh = meshPeerIds.has(sender.peer_id);
                    return (
                      <TableRow key={sender.peer_id}>
                        <TableCell className="text-xs font-mono py-2">
                          <Badge
                            variant="outline"
                            className={cn(
                              'text-[10px]',
                              index === 0 && 'text-yellow-600 border-yellow-300 bg-yellow-50',
                              index === 1 && 'text-gray-500 border-gray-300 bg-gray-50',
                              index === 2 && 'text-orange-600 border-orange-300 bg-orange-50'
                            )}
                          >
                            {index + 1}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs font-mono py-2">
                          <TooltipProvider delayDuration={0}>
                            <Tooltip open={copiedPeerId === sender.peer_id ? true : undefined}>
                              <TooltipTrigger asChild>
                                <div
                                  className="flex items-center gap-1 cursor-pointer hover:bg-muted/50 rounded px-1 -mx-1 transition-colors"
                                  onClick={() => copyToClipboard(sender.peer_id)}
                                >
                                  {copiedPeerId === sender.peer_id ? (
                                    <Check className="h-3 w-3 text-green-500 flex-shrink-0" />
                                  ) : (
                                    <Copy className="h-3 w-3 text-muted-foreground flex-shrink-0 opacity-50" />
                                  )}
                                  <span className="truncate">{sender.peer_id.slice(0, 8)}...{sender.peer_id.slice(-8)}</span>
                                </div>
                              </TooltipTrigger>
                              <TooltipContent>
                                {copiedPeerId === sender.peer_id ? (
                                  <p>Copied!</p>
                                ) : (
                                  <p className="font-mono text-xs break-all max-w-[300px]">{sender.peer_id}</p>
                                )}
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </TableCell>
                        <TableCell className="text-xs py-2">
                          {isInMesh ? (
                            <Badge variant="outline" className="text-[10px] text-green-600 border-green-200 bg-green-50">
                              ✓ In Mesh
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-[10px] text-gray-400 border-gray-200 bg-gray-50">
                              Not in Mesh
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-xs text-right py-2">
                          <div className="flex flex-col items-end">
                            <span className="font-bold">{sender.count}</span>
                            <span className="text-muted-foreground text-[10px]">{percentage.toFixed(1)}%</span>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            <strong>Note:</strong> Stats only count the first time each block is received. Duplicate messages from other peers are not counted.
          </p>
        </TabsContent>
      </Tabs>
    </div>
  );
}
