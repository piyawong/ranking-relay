'use client';

import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import dynamic from 'next/dynamic';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import RelayNodeDetail from '@/components/RelayNodeDetail';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertTriangle,
  RefreshCw,
  Server,
  MapPin,
  Search,
  ChevronLeft,
  ChevronRight,
  Globe,
  Activity,
  Plus,
  Pencil,
  Trash2,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const RelayNodeMap = dynamic(() => import('@/components/RelayNodeMap'), {
  ssr: false,
  loading: () => (
    <div className="h-full w-full flex items-center justify-center bg-gray-100">
      <div className="text-gray-500">Loading map...</div>
    </div>
  ),
});

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
  created_at: string;
  updated_at: string;
}

async function fetchRelayNodes(): Promise<{ data: RelayNode[] }> {
  const response = await fetch('/api/relay-nodes');
  if (!response.ok) throw new Error('Failed to fetch relay nodes');
  return response.json();
}

interface RelayFormData {
  name: string;
  tag: string;
  description: string;
  latitude: string;
  longitude: string;
  location: string;
  country: string;
  status: 'active' | 'inactive' | 'maintenance';
  endpoint: string;
}

const emptyFormData: RelayFormData = {
  name: '',
  tag: '',
  description: '',
  latitude: '',
  longitude: '',
  location: '',
  country: '',
  status: 'active',
  endpoint: '',
};

export default function RelaysPage() {
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [tagFilter, setTagFilter] = useState('all');
  const [selectedNode, setSelectedNode] = useState<RelayNode | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [configRefreshKey, setConfigRefreshKey] = useState(0);

  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingNode, setEditingNode] = useState<RelayNode | null>(null);
  const [formData, setFormData] = useState<RelayFormData>(emptyFormData);

  // Delete confirmation state
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [nodeToDelete, setNodeToDelete] = useState<RelayNode | null>(null);

  // Callback to trigger map config refresh when config is updated in RelayNodeDetail
  const handleConfigChange = () => {
    setConfigRefreshKey((prev) => prev + 1);
  };

  const { data, isLoading, refetch } = useQuery<{ data: RelayNode[] }>({
    queryKey: ['relay-nodes'],
    queryFn: fetchRelayNodes,
  });

  // Create mutation
  const createMutation = useMutation({
    mutationFn: async (data: RelayFormData) => {
      const response = await fetch('/api/relay-nodes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: data.name,
          tag: data.tag || null,
          description: data.description || null,
          latitude: parseFloat(data.latitude),
          longitude: parseFloat(data.longitude),
          location: data.location || null,
          country: data.country || null,
          status: data.status,
          endpoint: data.endpoint || null,
        }),
      });
      if (!response.ok) throw new Error('Failed to create relay node');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['relay-nodes'] });
      setIsModalOpen(false);
      setFormData(emptyFormData);
    },
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: RelayFormData }) => {
      const response = await fetch(`/api/relay-nodes/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: data.name,
          tag: data.tag || null,
          description: data.description || null,
          latitude: parseFloat(data.latitude),
          longitude: parseFloat(data.longitude),
          location: data.location || null,
          country: data.country || null,
          status: data.status,
          endpoint: data.endpoint || null,
        }),
      });
      if (!response.ok) throw new Error('Failed to update relay node');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['relay-nodes'] });
      setIsModalOpen(false);
      setFormData(emptyFormData);
      setEditingNode(null);
      // Refresh selected node if it was edited
      if (selectedNode && editingNode?.id === selectedNode.id) {
        setSelectedNode(null);
      }
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/relay-nodes/${id}`, {
        method: 'DELETE',
      });
      if (!response.ok) throw new Error('Failed to delete relay node');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['relay-nodes'] });
      setIsDeleteDialogOpen(false);
      setNodeToDelete(null);
      // Clear selected node if it was deleted
      if (selectedNode && nodeToDelete?.id === selectedNode.id) {
        setSelectedNode(null);
      }
    },
  });

  const handleOpenAddModal = () => {
    setEditingNode(null);
    setFormData(emptyFormData);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (node: RelayNode, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingNode(node);
    setFormData({
      name: node.name,
      tag: node.tag || '',
      description: node.description || '',
      latitude: String(node.latitude),
      longitude: String(node.longitude),
      location: node.location || '',
      country: node.country || '',
      status: node.status as 'active' | 'inactive' | 'maintenance',
      endpoint: node.endpoint || '',
    });
    setIsModalOpen(true);
  };

  const handleSubmit = () => {
    if (!formData.name || !formData.latitude || !formData.longitude) return;

    if (editingNode) {
      updateMutation.mutate({ id: editingNode.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const handleOpenDeleteDialog = (node: RelayNode, e: React.MouseEvent) => {
    e.stopPropagation();
    setNodeToDelete(node);
    setIsDeleteDialogOpen(true);
  };

  const handleConfirmDelete = () => {
    if (nodeToDelete) {
      deleteMutation.mutate(nodeToDelete.id);
    }
  };

  const nodes: RelayNode[] = data?.data || [];

  const uniqueTags = useMemo(() => {
    const tags = new Set<string>();
    nodes.forEach((node) => {
      if (node.tag) tags.add(node.tag);
    });
    return Array.from(tags).sort();
  }, [nodes]);

  const filteredNodes: RelayNode[] = useMemo(() => {
    let result = nodes;

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (node) =>
          node.name.toLowerCase().includes(query) ||
          node.location?.toLowerCase().includes(query) ||
          node.country?.toLowerCase().includes(query) ||
          node.tag?.toLowerCase().includes(query)
      );
    }

    if (statusFilter !== 'all') {
      result = result.filter((node) => node.status === statusFilter);
    }

    if (tagFilter !== 'all') {
      result = result.filter((node) => node.tag === tagFilter);
    }

    return result;
  }, [nodes, searchQuery, statusFilter, tagFilter]);

  const statusCounts = useMemo(() => {
    const counts = { active: 0, inactive: 0, maintenance: 0 };
    nodes.forEach((node) => {
      if (node.status in counts) {
        counts[node.status as keyof typeof counts]++;
      }
    });
    return counts;
  }, [nodes]);

  const handleNodeSelect = (node: RelayNode) => {
    setSelectedNode(node);
    if (!sidebarOpen) {
      setSidebarOpen(true);
    }
  };

  return (
    <div className="h-[calc(100vh-80px)] flex flex-col">
      {/* Header */}
      <div className="flex-shrink-0 p-4 border-b bg-background">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <Globe className="h-8 w-8 text-primary" />
            <div>
              <h1 className="text-2xl font-bold">Relay Network Map</h1>
              <p className="text-sm text-muted-foreground">
                Global distribution of relay nodes
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* Stats Pills */}
            <div className="hidden md:flex items-center gap-2 mr-4">
              <Badge variant="outline" className="gap-1">
                <Server className="h-3 w-3" />
                {nodes.length} Total
              </Badge>
              <Badge variant="outline" className="gap-1 text-green-600 border-green-200 bg-green-50">
                <Activity className="h-3 w-3" />
                {statusCounts.active} Active
              </Badge>
              {statusCounts.inactive > 0 && (
                <Badge variant="outline" className="gap-1 text-red-600 border-red-200 bg-red-50">
                  {statusCounts.inactive} Inactive
                </Badge>
              )}
              {statusCounts.maintenance > 0 && (
                <Badge variant="outline" className="gap-1 text-yellow-600 border-yellow-200 bg-yellow-50">
                  {statusCounts.maintenance} Maintenance
                </Badge>
              )}
            </div>
            <Button
              size="sm"
              onClick={handleOpenAddModal}
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Relay
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetch()}
              disabled={isLoading}
            >
              <RefreshCw className={cn('h-4 w-4 mr-2', isLoading && 'animate-spin')} />
              Refresh
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSidebarOpen(!sidebarOpen)}
            >
              {sidebarOpen ? (
                <ChevronRight className="h-4 w-4" />
              ) : (
                <ChevronLeft className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Map */}
        <div className="flex-1 relative">
          <RelayNodeMap
            nodes={filteredNodes}
            selectedNode={selectedNode}
            onNodeSelect={(node) => handleNodeSelect(node as RelayNode)}
            configRefreshKey={configRefreshKey}
          />
        </div>

        {/* Sidebar */}
        <div
          className={cn(
            'flex-shrink-0 border-l bg-background transition-all duration-300 overflow-hidden',
            sidebarOpen ? (selectedNode ? 'w-[600px]' : 'w-80') : 'w-0'
          )}
        >
          <div className={cn('h-full flex flex-col', selectedNode ? 'w-[600px]' : 'w-80')}>
            {/* Show RelayNodeDetail when a node is selected */}
            {selectedNode ? (
              <div className="h-full flex flex-col">
                {/* Back button */}
                <div className="p-2 border-b flex items-center">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelectedNode(null)}
                    className="h-8"
                  >
                    <ChevronLeft className="h-4 w-4 mr-1" />
                    Back to list
                  </Button>
                </div>
                {/* Node Detail */}
                <div className="flex-1 overflow-hidden">
                  <RelayNodeDetail node={selectedNode} onConfigChange={handleConfigChange} />
                </div>
              </div>
            ) : (
              <>
                {/* Filters */}
                <div className="p-4 border-b space-y-3">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search nodes..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-9 h-9"
                    />
                  </div>
                  <div className="flex gap-2">
                    <Select value={statusFilter} onValueChange={setStatusFilter}>
                      <SelectTrigger className="h-9 flex-1">
                        <SelectValue placeholder="Status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Status</SelectItem>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="inactive">Inactive</SelectItem>
                        <SelectItem value="maintenance">Maintenance</SelectItem>
                      </SelectContent>
                    </Select>
                    <Select value={tagFilter} onValueChange={setTagFilter}>
                      <SelectTrigger className="h-9 flex-1">
                        <SelectValue placeholder="Tag" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Tags</SelectItem>
                        {uniqueTags.map((tag) => (
                          <SelectItem key={tag} value={tag}>
                            {tag}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Node List */}
                <div className="flex-1 overflow-y-auto">
                  {isLoading ? (
                    <div className="flex items-center justify-center p-8">
                      <div className="text-muted-foreground">Loading...</div>
                    </div>
                  ) : filteredNodes.length === 0 ? (
                    <div className="flex flex-col items-center justify-center p-8 text-center">
                      <MapPin className="h-8 w-8 text-muted-foreground mb-2" />
                      <p className="text-sm text-muted-foreground">No nodes found</p>
                    </div>
                  ) : (
                    <div className="divide-y">
                      {filteredNodes.map((node) => (
                        <button
                          key={node.id}
                          className="w-full p-3 text-left hover:bg-muted/50 transition-colors group"
                          onClick={() => handleNodeSelect(node)}
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex-1 min-w-0">
                              <p className="font-medium truncate">{node.name}</p>
                              <p className="text-xs text-muted-foreground truncate">
                                {node.location || node.country || 'No location'}
                              </p>
                            </div>
                            <div className="flex items-center gap-2 ml-2">
                              {node.tag && (
                                <Badge variant="outline" className="text-xs">
                                  {node.tag}
                                </Badge>
                              )}
                              <div
                                className={cn(
                                  'w-2 h-2 rounded-full',
                                  node.status === 'active' && 'bg-green-500',
                                  node.status === 'inactive' && 'bg-red-500',
                                  node.status === 'maintenance' && 'bg-yellow-500'
                                )}
                              />
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                                onClick={(e) => handleOpenEditModal(node, e)}
                              >
                                <Pencil className="h-3 w-3" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:text-destructive"
                                onClick={(e) => handleOpenDeleteDialog(node, e)}
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Footer */}
                <div className="p-3 border-t text-xs text-muted-foreground text-center">
                  Showing {filteredNodes.length} of {nodes.length} nodes
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Add/Edit Relay Modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>
              {editingNode ? 'Edit Relay Node' : 'Add New Relay Node'}
            </DialogTitle>
            <DialogDescription>
              {editingNode
                ? 'Update the relay node information below.'
                : 'Fill in the details to add a new relay node to the network.'}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            {/* Name */}
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="name" className="text-right">
                Name *
              </Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="col-span-3"
                placeholder="e.g., US-East-1"
              />
            </div>

            {/* Endpoint */}
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="endpoint" className="text-right">
                Endpoint
              </Label>
              <Input
                id="endpoint"
                value={formData.endpoint}
                onChange={(e) => setFormData({ ...formData, endpoint: e.target.value })}
                className="col-span-3"
                placeholder="e.g., 192.168.1.100"
              />
            </div>

            {/* Latitude & Longitude */}
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="latitude" className="text-right">
                Lat/Lng *
              </Label>
              <div className="col-span-3 flex gap-2">
                <Input
                  id="latitude"
                  type="number"
                  step="any"
                  value={formData.latitude}
                  onChange={(e) => setFormData({ ...formData, latitude: e.target.value })}
                  placeholder="Latitude"
                />
                <Input
                  id="longitude"
                  type="number"
                  step="any"
                  value={formData.longitude}
                  onChange={(e) => setFormData({ ...formData, longitude: e.target.value })}
                  placeholder="Longitude"
                />
              </div>
            </div>

            {/* Location & Country */}
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="location" className="text-right">
                Location
              </Label>
              <div className="col-span-3 flex gap-2">
                <Input
                  id="location"
                  value={formData.location}
                  onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                  placeholder="City"
                />
                <Input
                  id="country"
                  value={formData.country}
                  onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                  placeholder="Country"
                />
              </div>
            </div>

            {/* Tag */}
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="tag" className="text-right">
                Tag
              </Label>
              <Input
                id="tag"
                value={formData.tag}
                onChange={(e) => setFormData({ ...formData, tag: e.target.value })}
                className="col-span-3"
                placeholder="e.g., production, staging"
              />
            </div>

            {/* Status */}
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="status" className="text-right">
                Status
              </Label>
              <Select
                value={formData.status}
                onValueChange={(value: 'active' | 'inactive' | 'maintenance') =>
                  setFormData({ ...formData, status: value })
                }
              >
                <SelectTrigger className="col-span-3">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                  <SelectItem value="maintenance">Maintenance</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Description */}
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="description" className="text-right">
                Description
              </Label>
              <Input
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="col-span-3"
                placeholder="Optional description"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsModalOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={
                !formData.name ||
                !formData.latitude ||
                !formData.longitude ||
                createMutation.isPending ||
                updateMutation.isPending
              }
            >
              {createMutation.isPending || updateMutation.isPending
                ? 'Saving...'
                : editingNode
                ? 'Update'
                : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              Delete Relay Node
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to delete <strong>{nodeToDelete?.name}</strong>?
              This action cannot be undone.
            </DialogDescription>
          </DialogHeader>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setIsDeleteDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleConfirmDelete}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? 'Deleting...' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
