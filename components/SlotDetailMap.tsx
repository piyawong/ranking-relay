'use client';

import { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

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
}

interface RelayDetail {
  id: string;
  relay_name: string;
  arrival_order: number;
  latency: number;
  loss: number;
  arrival_timestamp: string | null;
}

interface SlotDetailMapProps {
  relayNodes: RelayNode[];
  relayDetails: RelayDetail[]; // Visible relays only
  allRelayDetails: RelayDetail[]; // All relays for calculating original rank
  selectedRelay: string | null;
  onRelaySelect?: (relayName: string) => void;
}

// Get rank icon for marker
const getRankMarkerIcon = (rank: number, matched: boolean) => {
  // Define rank colors and icons
  const getRankDisplay = () => {
    if (rank === 1) return { emoji: '🥇', bg: '#fef3c7', border: '#f59e0b' };
    if (rank === 2) return { emoji: '🥈', bg: '#f3f4f6', border: '#9ca3af' };
    if (rank === 3) return { emoji: '🥉', bg: '#fed7aa', border: '#f97316' };
    return { emoji: String(rank), bg: '#e0e7ff', border: '#6366f1' };
  };

  const rankDisplay = getRankDisplay();

  // Gray out if not matched
  const bgColor = matched ? rankDisplay.bg : '#e5e7eb';
  const borderColor = matched ? rankDisplay.border : '#9ca3af';
  const opacity = matched ? '1' : '0.6';

  const size = rank <= 3 ? 36 : 28;
  const fontSize = rank <= 3 ? '16px' : '12px';

  return L.divIcon({
    className: 'rank-marker',
    html: `
      <div style="
        width: ${size}px;
        height: ${size}px;
        background-color: ${bgColor};
        border: 3px solid ${borderColor};
        border-radius: 50%;
        box-shadow: 0 2px 8px rgba(0,0,0,0.3);
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: ${fontSize};
        font-weight: bold;
        opacity: ${opacity};
      ">
        ${rank <= 3 ? rankDisplay.emoji : rankDisplay.emoji}
      </div>
    `,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    popupAnchor: [0, -size / 2],
  });
};

// Gray marker for unmatched relays
const getUnmatchedMarkerIcon = () => {
  return L.divIcon({
    className: 'unmatched-marker',
    html: `
      <div style="
        width: 20px;
        height: 20px;
        background-color: #9ca3af;
        border: 2px solid #6b7280;
        border-radius: 50%;
        box-shadow: 0 2px 4px rgba(0,0,0,0.2);
        opacity: 0.5;
      ">
      </div>
    `,
    iconSize: [20, 20],
    iconAnchor: [10, 10],
    popupAnchor: [0, -10],
  });
};

// Fixed world center for zoom out
const WORLD_CENTER: [number, number] = [20, 0];

// Format timestamp with milliseconds (H:MM:SS.mmm)
function formatTimeWithMs(timestamp: string | Date): string {
  const date = typeof timestamp === 'string' ? new Date(timestamp) : timestamp;
  const hours = date.getUTCHours();
  const minutes = date.getUTCMinutes().toString().padStart(2, '0');
  const seconds = date.getUTCSeconds().toString().padStart(2, '0');
  const milliseconds = date.getUTCMilliseconds().toString().padStart(3, '0');
  return `${hours}:${minutes}:${seconds}.${milliseconds}`;
}

function FitBounds({ nodes }: { nodes: RelayNode[] }) {
  const map = useMap();

  useEffect(() => {
    if (nodes.length > 0) {
      const bounds = L.latLngBounds(nodes.map(n => [n.latitude, n.longitude]));
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 5 });
    } else {
      map.setView(WORLD_CENTER, 2);
    }
  }, [map, nodes]);

  return null;
}

export default function SlotDetailMap({
  relayNodes,
  relayDetails,
  allRelayDetails,
  selectedRelay,
  onRelaySelect,
}: SlotDetailMapProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className="h-full w-full flex items-center justify-center bg-gray-100 rounded-lg">
        <div className="text-gray-500">Loading map...</div>
      </div>
    );
  }

  // Create a map of relay name -> relay detail (for ranking info)
  const relayDetailMap = new Map<string, RelayDetail>();
  relayDetails.forEach(detail => {
    relayDetailMap.set(detail.relay_name, detail);
  });

  // Create a map of relay name -> relay node (for location info)
  const relayNodeMap = new Map<string, RelayNode>();
  relayNodes.forEach(node => {
    relayNodeMap.set(node.name, node);
  });

  // Create a map of relay_name -> original rank from allRelayDetails
  // This ensures rank stays consistent even when some relays are hidden
  const originalRankMap = new Map<string, number>();
  const seenNodeIdsForRank = new Set<string>();
  let rankCounter = 1;
  [...allRelayDetails].sort((a, b) => a.arrival_order - b.arrival_order).forEach(detail => {
    const node = relayNodeMap.get(detail.relay_name);
    if (node) {
      if (!seenNodeIdsForRank.has(node.id)) {
        seenNodeIdsForRank.add(node.id);
        originalRankMap.set(detail.relay_name, rankCounter);
        rankCounter++;
      }
    } else {
      // No location - still assign rank
      originalRankMap.set(detail.relay_name, rankCounter);
      rankCounter++;
    }
  });

  // Find matched relays (relays that have both node config and block data)
  const matchedRelaysRaw: Array<{ node: RelayNode; detail: RelayDetail }> = [];
  const unmatchedNodes: RelayNode[] = [];

  // First, find all relay details that have matching nodes
  relayDetails.forEach(detail => {
    const node = relayNodeMap.get(detail.relay_name);
    if (node) {
      matchedRelaysRaw.push({ node, detail });
    }
  });

  // Find relay nodes that don't have matching relay details
  relayNodes.forEach(node => {
    if (!relayDetailMap.has(node.name)) {
      unmatchedNodes.push(node);
    }
  });

  // Sort matched relays by arrival order
  matchedRelaysRaw.sort((a, b) => a.detail.arrival_order - b.detail.arrival_order);

  // Filter duplicates by node.id - keep only the fastest (lowest arrival_order)
  const seenNodeIds = new Set<string>();
  const matchedRelays: Array<{ node: RelayNode; detail: RelayDetail }> = [];
  matchedRelaysRaw.forEach(item => {
    if (!seenNodeIds.has(item.node.id)) {
      seenNodeIds.add(item.node.id);
      matchedRelays.push(item);
    }
  });

  const defaultCenter: [number, number] = matchedRelays.length > 0
    ? [matchedRelays[0].node.latitude, matchedRelays[0].node.longitude]
    : relayNodes.length > 0
    ? [relayNodes[0].latitude, relayNodes[0].longitude]
    : WORLD_CENTER;

  // All nodes that should be shown (for fit bounds)
  const allVisibleNodes = [...matchedRelays.map(m => m.node), ...unmatchedNodes];

  return (
    <MapContainer
      center={defaultCenter}
      zoom={2}
      className="h-full w-full rounded-lg"
      style={{ minHeight: '400px', zIndex: 0 }}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <FitBounds nodes={allVisibleNodes} />

      {/* Unmatched relay nodes (gray markers) */}
      {unmatchedNodes.map((node) => (
        <Marker
          key={`unmatched-${node.id}`}
          position={[node.latitude, node.longitude]}
          icon={getUnmatchedMarkerIcon()}
        >
          <Popup>
            <div className="min-w-[180px]">
              <h3 className="font-bold text-base text-gray-500">{node.name}</h3>
              {node.location && (
                <p className="text-sm text-gray-400">
                  {node.location}{node.country ? `, ${node.country}` : ''}
                </p>
              )}
              <p className="text-xs text-gray-400 mt-2 italic">
                No data for this block
              </p>
            </div>
          </Popup>
        </Marker>
      ))}

      {/* Matched relays with rank icons - sort by rank so lower rank renders last (on top) */}
      {[...matchedRelays]
        .sort((a, b) => {
          const rankA = originalRankMap.get(a.detail.relay_name) || 999;
          const rankB = originalRankMap.get(b.detail.relay_name) || 999;
          return rankB - rankA; // Higher rank first, so lower rank renders last (on top)
        })
        .map(({ node, detail }) => {
        const rank = originalRankMap.get(detail.relay_name) || 999;
        // Higher zIndexOffset for lower rank numbers (rank 1 = highest z-index)
        const zIndex = (100 - rank) * 100;

        return (
          <Marker
            key={`ranked-${node.id}`}
            position={[node.latitude, node.longitude]}
            icon={getRankMarkerIcon(rank, true)}
            zIndexOffset={zIndex}
            eventHandlers={{
              click: () => onRelaySelect?.(detail.relay_name),
            }}
          >
            <Popup>
              <div className="min-w-[220px]">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-2xl">
                    {rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : `#${rank}`}
                  </span>
                  <h3 className="font-bold text-lg">{node.name}</h3>
                </div>
                {node.location && (
                  <p className="text-sm text-gray-600">
                    {node.location}{node.country ? `, ${node.country}` : ''}
                  </p>
                )}
                <div className="mt-3 pt-2 border-t border-gray-200 space-y-1">
                  <p className="text-sm">
                    <span className="text-gray-500">Latency:</span>{' '}
                    <span className={`font-semibold ${
                      detail.latency < 50 ? 'text-green-600' :
                      detail.latency < 100 ? 'text-yellow-600' : 'text-red-600'
                    }`}>
                      {detail.latency.toFixed(1)}ms
                    </span>
                  </p>
                  <p className="text-sm">
                    <span className="text-gray-500">Packet Loss:</span>{' '}
                    <span className={`font-semibold ${
                      detail.loss < 0.5 ? 'text-green-600' :
                      detail.loss < 1.5 ? 'text-yellow-600' : 'text-red-600'
                    }`}>
                      {detail.loss.toFixed(2)}%
                    </span>
                  </p>
                  {detail.arrival_timestamp && (
                    <p className="text-sm">
                      <span className="text-gray-500">Arrival:</span>{' '}
                      <span className="font-mono text-xs">
                        {formatTimeWithMs(detail.arrival_timestamp)} UTC
                      </span>
                    </p>
                  )}
                </div>
              </div>
            </Popup>
          </Marker>
        );
      })}
    </MapContainer>
  );
}
