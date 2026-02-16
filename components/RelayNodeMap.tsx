'use client';

import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap, Circle } from 'react-leaflet';
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
  port?: number;
  created_at?: string;
  updated_at?: string;
}

// Group nodes by location (same lat/lng)
interface NodeGroup {
  key: string;
  latitude: number;
  longitude: number;
  nodes: RelayNode[];
}

interface NodeConfig {
  target_peers: number;
  max_latency_ms: number;
}

// Convert latency (ms) to radius (meters) for map visualization
// Using a logarithmic scale: higher latency = larger coverage area
// 50ms → ~300km, 100ms → ~500km, 200ms → ~800km, 500ms → ~1500km
function latencyToRadius(latencyMs: number): number {
  const baseRadius = 150000; // 150km base
  const scaleFactor = 3000; // meters per ms
  return baseRadius + (latencyMs * scaleFactor);
}

interface RelayNodeMapProps {
  nodes: RelayNode[];
  selectedNode: RelayNode | null;
  onNodeSelect: (node: RelayNode) => void;
  onMapClick?: (lat: number, lng: number) => void;
  configRefreshKey?: number; // Increment this to trigger config refresh
}

const statusColors: Record<string, string> = {
  active: '#22c55e',
  inactive: '#ef4444',
  maintenance: '#f59e0b',
};

const getMarkerIcon = (status: string) => {
  const color = statusColors[status] || '#6b7280';

  return L.divIcon({
    className: 'custom-marker',
    html: `
      <div style="
        width: 24px;
        height: 24px;
        background-color: ${color};
        border: 3px solid white;
        border-radius: 50%;
        box-shadow: 0 2px 8px rgba(0,0,0,0.3);
        display: flex;
        align-items: center;
        justify-content: center;
      ">
        <div style="
          width: 8px;
          height: 8px;
          background-color: white;
          border-radius: 50%;
        "></div>
      </div>
    `,
    iconSize: [24, 24],
    iconAnchor: [12, 12],
    popupAnchor: [0, -12],
  });
};

// Cluster marker icon with count badge
const getClusterIcon = (nodes: RelayNode[]) => {
  // Determine color based on majority status
  const statusCount: Record<string, number> = { active: 0, inactive: 0, maintenance: 0 };
  nodes.forEach(n => {
    if (n.status in statusCount) statusCount[n.status]++;
  });
  const dominantStatus = Object.entries(statusCount).sort((a, b) => b[1] - a[1])[0][0];
  const color = statusColors[dominantStatus] || '#6b7280';
  const count = nodes.length;

  return L.divIcon({
    className: 'custom-cluster-marker',
    html: `
      <div style="
        position: relative;
        width: 32px;
        height: 32px;
        background-color: ${color};
        border: 3px solid white;
        border-radius: 50%;
        box-shadow: 0 2px 8px rgba(0,0,0,0.3);
        display: flex;
        align-items: center;
        justify-content: center;
      ">
        <span style="
          color: white;
          font-size: 12px;
          font-weight: bold;
          text-shadow: 0 1px 2px rgba(0,0,0,0.5);
        ">${count}</span>
      </div>
    `,
    iconSize: [32, 32],
    iconAnchor: [16, 16],
    popupAnchor: [0, -16],
  });
};

// Group nodes by their location (round to 4 decimal places to handle floating point)
function groupNodesByLocation(nodes: RelayNode[]): NodeGroup[] {
  const groups = new Map<string, NodeGroup>();

  nodes.forEach(node => {
    // Round to 4 decimal places (~11m precision) to group nearby nodes
    const lat = Math.round(node.latitude * 10000) / 10000;
    const lng = Math.round(node.longitude * 10000) / 10000;
    const key = `${lat},${lng}`;

    if (!groups.has(key)) {
      groups.set(key, {
        key,
        latitude: lat,
        longitude: lng,
        nodes: [],
      });
    }
    groups.get(key)!.nodes.push(node);
  });

  return Array.from(groups.values());
}

function MapClickHandler({ onMapClick }: { onMapClick?: (lat: number, lng: number) => void }) {
  const map = useMap();

  useEffect(() => {
    if (!onMapClick) return;

    const handleClick = (e: L.LeafletMouseEvent) => {
      onMapClick(e.latlng.lat, e.latlng.lng);
    };

    map.on('click', handleClick);
    return () => {
      map.off('click', handleClick);
    };
  }, [map, onMapClick]);

  return null;
}

// Fixed world center for zoom out
const WORLD_CENTER: [number, number] = [20, 0];

function FlyToNode({ node }: { node: RelayNode | null }) {
  const map = useMap();
  const prevNodeId = useRef<string | null>(null);

  useEffect(() => {
    const currentNodeId = node?.id ?? null;

    // Only trigger fly animation when node actually changes
    if (currentNodeId === prevNodeId.current) return;

    prevNodeId.current = currentNodeId;

    if (node) {
      // Zoom in to selected node
      map.flyTo([node.latitude, node.longitude], 6, { duration: 1 });
    } else {
      // Zoom out to world view when deselected (back to list) - faster animation
      map.flyTo(WORLD_CENTER, 2, { duration: 0.5 });
    }
  }, [map, node]);

  return null;
}

// Helper to build proxy URL for fetching node config
function buildProxyUrl(endpoint: string, path: string): string {
  return `/api/relay-proxy?endpoint=${encodeURIComponent(endpoint)}&path=${encodeURIComponent(path)}`;
}

export default function RelayNodeMap({
  nodes,
  selectedNode,
  onNodeSelect,
  onMapClick,
  configRefreshKey = 0,
}: RelayNodeMapProps) {
  const [mounted, setMounted] = useState(false);
  const [nodeConfigs, setNodeConfigs] = useState<Record<string, NodeConfig>>({});
  const [pulsePhase, setPulsePhase] = useState(0);

  // Group nodes by location for clustering
  const nodeGroups = useMemo(() => groupNodesByLocation(nodes), [nodes]);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Fetch config for each node with an endpoint
  const fetchNodeConfigs = useCallback(async () => {
    const configs: Record<string, NodeConfig> = {};

    await Promise.all(
      nodes
        .filter(node => node.endpoint)
        .map(async (node) => {
          try {
            const res = await fetch(buildProxyUrl(node.endpoint!, '/config'));
            if (res.ok) {
              const config = await res.json();
              configs[node.id] = config;
            }
          } catch (error) {
            // Silently fail for unreachable nodes
          }
        })
    );

    setNodeConfigs(configs);
  }, [nodes]);

  // Fetch configs on mount and when nodes change
  useEffect(() => {
    if (mounted && nodes.length > 0) {
      fetchNodeConfigs();
    }
  }, [mounted, nodes, fetchNodeConfigs]);

  // Re-fetch configs when configRefreshKey changes (triggered by config updates)
  useEffect(() => {
    if (mounted && configRefreshKey > 0) {
      fetchNodeConfigs();
    }
  }, [mounted, configRefreshKey, fetchNodeConfigs]);

  // Periodic refresh of configs every 30 seconds
  useEffect(() => {
    if (!mounted) return;

    const interval = setInterval(() => {
      fetchNodeConfigs();
    }, 30000);

    return () => clearInterval(interval);
  }, [mounted, fetchNodeConfigs]);

  // Pulse animation for radar effect (slower frequency)
  useEffect(() => {
    const interval = setInterval(() => {
      setPulsePhase((prev) => (prev + 1) % 100);
    }, 150); // Slower animation: 150ms instead of 50ms
    return () => clearInterval(interval);
  }, []);

  if (!mounted) {
    return (
      <div className="h-full w-full flex items-center justify-center bg-gray-100 rounded-lg">
        <div className="text-gray-500">Loading map...</div>
      </div>
    );
  }

  const defaultCenter: [number, number] = nodes.length > 0
    ? [nodes[0].latitude, nodes[0].longitude]
    : [20, 0];

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
      <MapClickHandler onMapClick={onMapClick} />
      <FlyToNode node={selectedNode} />

      {/* Coverage circles (radar effect) - rendered first so they appear behind markers */}
      {/* Each node's radius is based on its own max_latency_ms config */}
      {nodes.map((node) => {
        const config = nodeConfigs[node.id];
        if (!config) return null;

        const baseColor = statusColors[node.status] || '#6b7280';
        const maxRadius = latencyToRadius(config.max_latency_ms);
        const isSelected = selectedNode?.id === node.id;

        // Create multiple concentric circles for radar effect
        const circles = [];
        const numRings = 3;

        for (let i = 0; i < numRings; i++) {
          // Animate each ring outward
          const phase = ((pulsePhase + i * 33) % 100) / 100;
          const radius = maxRadius * (0.3 + phase * 0.7);
          const opacity = isSelected
            ? 0.3 * (1 - phase * 0.7)
            : 0.15 * (1 - phase * 0.7);

          circles.push(
            <Circle
              key={`${node.id}-ring-${i}`}
              center={[node.latitude, node.longitude]}
              radius={radius}
              pathOptions={{
                color: baseColor,
                fillColor: baseColor,
                fillOpacity: opacity,
                weight: isSelected ? 2 : 1,
                opacity: opacity * 2,
              }}
            />
          );
        }

        // Static outer boundary circle
        circles.push(
          <Circle
            key={`${node.id}-boundary`}
            center={[node.latitude, node.longitude]}
            radius={maxRadius}
            pathOptions={{
              color: baseColor,
              fillColor: baseColor,
              fillOpacity: isSelected ? 0.1 : 0.05,
              weight: isSelected ? 2 : 1,
              opacity: isSelected ? 0.6 : 0.3,
              dashArray: '5, 5',
            }}
          />
        );

        return circles;
      })}

      {/* Node markers - grouped by location */}
      {nodeGroups.map((group) => {
        const { nodes: groupNodes, latitude, longitude, key } = group;

        // Single node - render normal marker
        if (groupNodes.length === 1) {
          const node = groupNodes[0];
          const config = nodeConfigs[node.id];

          return (
            <Marker
              key={key}
              position={[latitude, longitude]}
              icon={getMarkerIcon(node.status)}
              eventHandlers={{
                click: () => onNodeSelect(node),
              }}
            >
              <Popup>
                <div className="min-w-[200px]">
                  <h3 className="font-bold text-lg">{node.name}</h3>
                  {node.tag && (
                    <span className="inline-block px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded mt-1">
                      {node.tag}
                    </span>
                  )}
                  {node.location && (
                    <p className="text-sm text-gray-600 mt-2">
                      {node.location}{node.country ? `, ${node.country}` : ''}
                    </p>
                  )}
                  <p className="text-sm mt-1">
                    Status:{' '}
                    <span
                      className={`font-medium ${
                        node.status === 'active'
                          ? 'text-green-600'
                          : node.status === 'inactive'
                          ? 'text-red-600'
                          : 'text-yellow-600'
                      }`}
                    >
                      {node.status}
                    </span>
                  </p>
                  {config && (
                    <div className="mt-2 pt-2 border-t border-gray-200">
                      <p className="text-xs text-gray-500">Coverage Config:</p>
                      <p className="text-sm">
                        Max Latency: <span className="font-medium">{config.max_latency_ms}ms</span>
                      </p>
                      <p className="text-sm">
                        Target Peers: <span className="font-medium">{config.target_peers}</span>
                      </p>
                    </div>
                  )}
                  {node.description && (
                    <p className="text-sm text-gray-500 mt-2">{node.description}</p>
                  )}
                </div>
              </Popup>
            </Marker>
          );
        }

        // Multiple nodes at same location - render cluster marker
        return (
          <Marker
            key={key}
            position={[latitude, longitude]}
            icon={getClusterIcon(groupNodes)}
          >
            <Popup>
              <div className="min-w-[250px] max-h-[300px] overflow-y-auto">
                <h3 className="font-bold text-lg mb-2">
                  {groupNodes.length} Nodes at this location
                </h3>
                {groupNodes[0].location && (
                  <p className="text-sm text-gray-600 mb-3">
                    {groupNodes[0].location}{groupNodes[0].country ? `, ${groupNodes[0].country}` : ''}
                  </p>
                )}
                <div className="space-y-2">
                  {groupNodes.map((node) => (
                    <button
                      key={node.id}
                      onClick={() => onNodeSelect(node)}
                      className="w-full text-left p-2 rounded hover:bg-gray-100 transition-colors border border-gray-200"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-sm">{node.name}</span>
                        <span
                          className={`w-2 h-2 rounded-full ${
                            node.status === 'active'
                              ? 'bg-green-500'
                              : node.status === 'inactive'
                              ? 'bg-red-500'
                              : 'bg-yellow-500'
                          }`}
                        />
                      </div>
                      {node.tag && (
                        <span className="text-xs text-gray-500">{node.tag}</span>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            </Popup>
          </Marker>
        );
      })}
    </MapContainer>
  );
}
