'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import RelayNodeDetail from '@/components/RelayNodeDetail';
import { Button } from '@/components/ui/button';
import { X, Loader2 } from 'lucide-react';

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
  created_at: string;
  updated_at: string;
}

export default function ManageNodePopupPage() {
  const params = useParams();
  const nodeId = params.id as string;
  const [node, setNode] = useState<RelayNode | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchNode() {
      try {
        const res = await fetch(`/api/relay-nodes/${nodeId}`);
        if (!res.ok) {
          throw new Error('Failed to fetch node');
        }
        const data = await res.json();
        setNode(data.data);
        // Update window title
        document.title = `Manage: ${data.data.name}`;
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    }
    fetchNode();
  }, [nodeId]);

  const handleClose = () => {
    window.close();
  };

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !node) {
    return (
      <div className="h-screen flex flex-col items-center justify-center bg-background p-4">
        <p className="text-destructive mb-4">{error || 'Node not found'}</p>
        <Button onClick={handleClose}>Close</Button>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-background">
      {/* Header */}
      <div className="flex-shrink-0 p-3 border-b bg-muted/30 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div
            className={`w-2.5 h-2.5 rounded-full ${
              node.status === 'active'
                ? 'bg-green-500'
                : node.status === 'inactive'
                ? 'bg-red-500'
                : 'bg-yellow-500'
            }`}
          />
          <h1 className="font-semibold text-lg">{node.name}</h1>
          {node.location && (
            <span className="text-sm text-muted-foreground">
              ({node.location})
            </span>
          )}
        </div>
        <Button variant="ghost" size="sm" onClick={handleClose} className="h-8 w-8 p-0">
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        <RelayNodeDetail node={node} />
      </div>
    </div>
  );
}
