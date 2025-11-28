'use client';

import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import dynamic from 'next/dynamic';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
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
  RefreshCw,
  Plus,
  Pencil,
  Trash2,
  MapPin,
  Server,
  Search,
  Globe,
  Tag,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const RelayNodeMap = dynamic(() => import('@/components/RelayNodeMap'), {
  ssr: false,
  loading: () => (
    <div className="h-[400px] w-full flex items-center justify-center bg-gray-100 rounded-lg">
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

interface FormData {
  name: string;
  tag: string;
  description: string;
  latitude: string;
  longitude: string;
  location: string;
  country: string;
  status: string;
  endpoint: string;
}

const initialFormData: FormData = {
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

async function fetchRelayNodes(filters?: { status?: string; tag?: string }) {
  const params = new URLSearchParams();
  if (filters?.status && filters.status !== 'all') params.append('status', filters.status);
  if (filters?.tag && filters.tag !== 'all') params.append('tag', filters.tag);

  const response = await fetch(`/api/relay-nodes?${params.toString()}`);
  if (!response.ok) throw new Error('Failed to fetch relay nodes');
  return response.json();
}

async function createRelayNode(data: Partial<RelayNode>) {
  const response = await fetch('/api/relay-nodes', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to create relay node');
  }
  return response.json();
}

async function updateRelayNode(id: string, data: Partial<RelayNode>) {
  const response = await fetch(`/api/relay-nodes/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to update relay node');
  }
  return response.json();
}

async function deleteRelayNode(id: string) {
  const response = await fetch(`/api/relay-nodes/${id}`, {
    method: 'DELETE',
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to delete relay node');
  }
  return response.json();
}

export default function RelayManagementPage() {
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [tagFilter, setTagFilter] = useState('all');
  const [selectedNode, setSelectedNode] = useState<RelayNode | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [nodeToDelete, setNodeToDelete] = useState<RelayNode | null>(null);
  const [editingNode, setEditingNode] = useState<RelayNode | null>(null);
  const [formData, setFormData] = useState<FormData>(initialFormData);
  const [formError, setFormError] = useState<string | null>(null);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['relay-nodes'],
    queryFn: () => fetchRelayNodes(),
  });

  const createMutation = useMutation({
    mutationFn: createRelayNode,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['relay-nodes'] });
      setIsDialogOpen(false);
      resetForm();
    },
    onError: (error: Error) => {
      setFormError(error.message);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<RelayNode> }) =>
      updateRelayNode(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['relay-nodes'] });
      setIsDialogOpen(false);
      resetForm();
    },
    onError: (error: Error) => {
      setFormError(error.message);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteRelayNode,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['relay-nodes'] });
      setIsDeleteDialogOpen(false);
      setNodeToDelete(null);
      if (selectedNode?.id === nodeToDelete?.id) {
        setSelectedNode(null);
      }
    },
  });

  const resetForm = () => {
    setFormData(initialFormData);
    setEditingNode(null);
    setFormError(null);
  };

  const handleOpenCreateDialog = () => {
    resetForm();
    setIsDialogOpen(true);
  };

  const handleOpenEditDialog = (node: RelayNode) => {
    setEditingNode(node);
    setFormData({
      name: node.name,
      tag: node.tag || '',
      description: node.description || '',
      latitude: node.latitude.toString(),
      longitude: node.longitude.toString(),
      location: node.location || '',
      country: node.country || '',
      status: node.status,
      endpoint: node.endpoint || '',
    });
    setFormError(null);
    setIsDialogOpen(true);
  };

  const handleMapClick = (lat: number, lng: number) => {
    if (isDialogOpen) {
      setFormData((prev) => ({
        ...prev,
        latitude: lat.toFixed(6),
        longitude: lng.toFixed(6),
      }));
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const nodeData = {
      name: formData.name,
      tag: formData.tag || null,
      description: formData.description || null,
      latitude: parseFloat(formData.latitude),
      longitude: parseFloat(formData.longitude),
      location: formData.location || null,
      country: formData.country || null,
      status: formData.status,
      endpoint: formData.endpoint || null,
    };

    if (editingNode) {
      updateMutation.mutate({ id: editingNode.id, data: nodeData });
    } else {
      createMutation.mutate(nodeData);
    }
  };

  const handleDeleteClick = (node: RelayNode) => {
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

  const filteredNodes = useMemo(() => {
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

  return (
    <div className="space-y-6 p-4">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold">Relay Management</h1>
          <p className="text-muted-foreground">
            Manage relay nodes and view their global distribution
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isLoading}
          >
            <RefreshCw className={cn('h-4 w-4 mr-2', isLoading && 'animate-spin')} />
            Refresh
          </Button>
          <Button size="sm" onClick={handleOpenCreateDialog}>
            <Plus className="h-4 w-4 mr-2" />
            Add Node
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Server className="h-4 w-4" />
              Total Nodes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{nodes.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <div className="h-3 w-3 rounded-full bg-green-500" />
              Active
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-green-600">{statusCounts.active}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <div className="h-3 w-3 rounded-full bg-red-500" />
              Inactive
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-red-600">{statusCounts.inactive}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <div className="h-3 w-3 rounded-full bg-yellow-500" />
              Maintenance
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-yellow-600">{statusCounts.maintenance}</p>
          </CardContent>
        </Card>
      </div>

      {/* Map */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5" />
            Node Locations
          </CardTitle>
          <CardDescription>
            Click on markers to view node details. Click on the map while adding/editing to set coordinates.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[400px] rounded-lg overflow-hidden">
            <RelayNodeMap
              nodes={filteredNodes}
              selectedNode={selectedNode}
              onNodeSelect={(node) => setSelectedNode(node as RelayNode)}
              onMapClick={isDialogOpen ? handleMapClick : undefined}
            />
          </div>
        </CardContent>
      </Card>

      {/* Filters and Table */}
      <Card>
        <CardHeader>
          <CardTitle>Node List</CardTitle>
          <CardDescription>View and manage all relay nodes</CardDescription>
        </CardHeader>
        <CardContent>
          {/* Filters */}
          <div className="flex flex-col md:flex-row gap-4 mb-6">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by name, location, or tag..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full md:w-[160px]">
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
              <SelectTrigger className="w-full md:w-[160px]">
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

          {/* Table */}
          {isLoading ? (
            <div className="flex items-center justify-center p-8">
              <div className="text-muted-foreground">Loading nodes...</div>
            </div>
          ) : filteredNodes.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-8 text-center">
              <MapPin className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No relay nodes found</p>
              <Button className="mt-4" onClick={handleOpenCreateDialog}>
                <Plus className="h-4 w-4 mr-2" />
                Add First Node
              </Button>
            </div>
          ) : (
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Tag</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead>Coordinates</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredNodes.map((node) => (
                    <TableRow
                      key={node.id}
                      className={cn(
                        'cursor-pointer hover:bg-muted/50',
                        selectedNode?.id === node.id && 'bg-muted/50'
                      )}
                      onClick={() => setSelectedNode(node)}
                    >
                      <TableCell className="font-medium">{node.name}</TableCell>
                      <TableCell>
                        {node.tag ? (
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-blue-100 text-blue-800">
                            <Tag className="h-3 w-3 mr-1" />
                            {node.tag}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {node.location || node.country ? (
                          <span>
                            {node.location}
                            {node.location && node.country ? ', ' : ''}
                            {node.country}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell className="font-mono text-sm">
                        {node.latitude.toFixed(4)}, {node.longitude.toFixed(4)}
                      </TableCell>
                      <TableCell>
                        <span
                          className={cn(
                            'inline-flex items-center px-2 py-1 rounded-full text-xs font-medium',
                            node.status === 'active' && 'bg-green-100 text-green-800',
                            node.status === 'inactive' && 'bg-red-100 text-red-800',
                            node.status === 'maintenance' && 'bg-yellow-100 text-yellow-800'
                          )}
                        >
                          {node.status}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenEditDialog(node);
                            }}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteClick(node);
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          {filteredNodes.length > 0 && (
            <div className="mt-4 text-sm text-muted-foreground">
              Showing {filteredNodes.length} of {nodes.length} nodes
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingNode ? 'Edit Relay Node' : 'Add New Relay Node'}
            </DialogTitle>
            <DialogDescription>
              {editingNode
                ? 'Update the relay node information'
                : 'Fill in the details to add a new relay node. Click on the map to set coordinates.'}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit}>
            <div className="grid gap-4 py-4">
              {formError && (
                <div className="p-3 bg-red-50 text-red-700 rounded-md text-sm">
                  {formError}
                </div>
              )}
              <div className="grid gap-2">
                <label htmlFor="name" className="text-sm font-medium">
                  Name *
                </label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Node name"
                  required
                />
              </div>
              <div className="grid gap-2">
                <label htmlFor="tag" className="text-sm font-medium">
                  Tag
                </label>
                <Input
                  id="tag"
                  value={formData.tag}
                  onChange={(e) => setFormData({ ...formData, tag: e.target.value })}
                  placeholder="e.g., primary, backup, edge"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <label htmlFor="latitude" className="text-sm font-medium">
                    Latitude *
                  </label>
                  <Input
                    id="latitude"
                    type="number"
                    step="any"
                    value={formData.latitude}
                    onChange={(e) => setFormData({ ...formData, latitude: e.target.value })}
                    placeholder="-90 to 90"
                    required
                  />
                </div>
                <div className="grid gap-2">
                  <label htmlFor="longitude" className="text-sm font-medium">
                    Longitude *
                  </label>
                  <Input
                    id="longitude"
                    type="number"
                    step="any"
                    value={formData.longitude}
                    onChange={(e) => setFormData({ ...formData, longitude: e.target.value })}
                    placeholder="-180 to 180"
                    required
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <label htmlFor="location" className="text-sm font-medium">
                    City/Region
                  </label>
                  <Input
                    id="location"
                    value={formData.location}
                    onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                    placeholder="City name"
                  />
                </div>
                <div className="grid gap-2">
                  <label htmlFor="country" className="text-sm font-medium">
                    Country
                  </label>
                  <Input
                    id="country"
                    value={formData.country}
                    onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                    placeholder="Country"
                  />
                </div>
              </div>
              <div className="grid gap-2">
                <label htmlFor="status" className="text-sm font-medium">
                  Status
                </label>
                <Select
                  value={formData.status}
                  onValueChange={(value) => setFormData({ ...formData, status: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                    <SelectItem value="maintenance">Maintenance</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <label htmlFor="endpoint" className="text-sm font-medium">
                  Endpoint URL
                </label>
                <Input
                  id="endpoint"
                  type="url"
                  value={formData.endpoint}
                  onChange={(e) => setFormData({ ...formData, endpoint: e.target.value })}
                  placeholder="https://..."
                />
              </div>
              <div className="grid gap-2">
                <label htmlFor="description" className="text-sm font-medium">
                  Description
                </label>
                <Input
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Optional description"
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={createMutation.isPending || updateMutation.isPending}
              >
                {createMutation.isPending || updateMutation.isPending
                  ? 'Saving...'
                  : editingNode
                  ? 'Update'
                  : 'Create'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Relay Node</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &quot;{nodeToDelete?.name}&quot;? This action
              cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              className="bg-red-600 hover:bg-red-700"
            >
              {deleteMutation.isPending ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
