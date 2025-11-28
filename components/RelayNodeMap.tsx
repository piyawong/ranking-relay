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
  created_at?: string;
  updated_at?: string;
}

interface RelayNodeMapProps {
  nodes: RelayNode[];
  selectedNode: RelayNode | null;
  onNodeSelect: (node: RelayNode) => void;
  onMapClick?: (lat: number, lng: number) => void;
}

const getMarkerIcon = (status: string) => {
  const colors: Record<string, string> = {
    active: '#22c55e',
    inactive: '#ef4444',
    maintenance: '#f59e0b',
  };
  const color = colors[status] || '#6b7280';

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

function FlyToNode({ node }: { node: RelayNode | null }) {
  const map = useMap();

  useEffect(() => {
    if (node) {
      map.flyTo([node.latitude, node.longitude], 6, { duration: 1 });
    }
  }, [map, node]);

  return null;
}

export default function RelayNodeMap({
  nodes,
  selectedNode,
  onNodeSelect,
  onMapClick,
}: RelayNodeMapProps) {
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

  const defaultCenter: [number, number] = nodes.length > 0
    ? [nodes[0].latitude, nodes[0].longitude]
    : [20, 0];

  return (
    <MapContainer
      center={defaultCenter}
      zoom={2}
      className="h-full w-full rounded-lg"
      style={{ minHeight: '400px' }}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <MapClickHandler onMapClick={onMapClick} />
      <FlyToNode node={selectedNode} />
      {nodes.map((node) => (
        <Marker
          key={node.id}
          position={[node.latitude, node.longitude]}
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
              {node.description && (
                <p className="text-sm text-gray-500 mt-2">{node.description}</p>
              )}
            </div>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}
