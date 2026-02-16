'use client';

import { useState, useEffect, useRef, useCallback, Suspense } from 'react';
import { useQuery } from '@tanstack/react-query';
import dynamic from 'next/dynamic';
import { useSearchParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import {
  RefreshCw,
  Search,
  Award,
  Zap,
  Timer,
  Package,
  MapPin,
  ChevronLeft,
  ChevronRight,
  ArrowLeft,
  Eye,
  EyeOff,
  Play,
  Square,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import Link from 'next/link';

// Dynamic import for the map component (SSR disabled)
const SlotDetailMap = dynamic(() => import('@/components/SlotDetailMap'), {
  ssr: false,
  loading: () => (
    <div className="h-full w-full flex items-center justify-center bg-gray-100 rounded-lg">
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
}

interface RelayDetail {
  id: string;
  relay_name: string;
  arrival_order: number;
  latency: number;
  loss: number;
  arrival_timestamp: string | null;
}

interface BlockData {
  id: string;
  block_number: number;
  block_hash: string | null;
  created_at: string;
  bloxroute_timestamp: string | null;
  origin: string | null;
  relay_details: RelayDetail[];
}

// Format timestamp to UTC format (H:MM:SS.mmm)
function formatUTCTimestamp(timestamp: string | Date): string {
  const date = typeof timestamp === 'string' ? new Date(timestamp) : timestamp;
  const hours = date.getUTCHours();
  const minutes = date.getUTCMinutes().toString().padStart(2, '0');
  const seconds = date.getUTCSeconds().toString().padStart(2, '0');
  const milliseconds = date.getUTCMilliseconds().toString().padStart(3, '0');
  return `${hours}:${minutes}:${seconds}.${milliseconds}`;
}

// Format full date for display
function formatFullDate(timestamp: string | Date): string {
  const date = typeof timestamp === 'string' ? new Date(timestamp) : timestamp;
  return date.toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

// Fetch block data by block number
async function fetchBlockData(blockNumber: number): Promise<BlockData> {
  const response = await fetch(`/api/relays/${blockNumber}`);
  if (!response.ok) {
    if (response.status === 404) {
      throw new Error('Block not found');
    }
    throw new Error('Failed to fetch block data');
  }
  const data = await response.json();
  return data.data;
}

// Fetch latest block info
async function fetchLatestBlock() {
  const response = await fetch('/api/relays?limit=1');
  if (!response.ok) throw new Error('Failed to fetch latest block');
  const data = await response.json();
  return data.data.blocks[0];
}

// Fetch relay nodes
async function fetchRelayNodes(): Promise<RelayNode[]> {
  const response = await fetch('/api/relay-nodes');
  if (!response.ok) throw new Error('Failed to fetch relay nodes');
  const data = await response.json();
  return data.data;
}

function SlotDetailContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [blockInput, setBlockInput] = useState('');
  const [selectedBlock, setSelectedBlock] = useState<number | null>(null);
  const [selectedRelay, setSelectedRelay] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  // Track hidden by node.id (for relays with location) or relay_name (for those without)
  const [hiddenRelays, setHiddenRelays] = useState<Set<string>>(new Set());

  // Auto-play animation state
  const [isAutoPlaying, setIsAutoPlaying] = useState(false);
  const [autoPlayInterval, setAutoPlayInterval] = useState(1000); // milliseconds
  const [autoPlayStep, setAutoPlayStep] = useState(0);
  const autoPlayTimerRef = useRef<NodeJS.Timeout | null>(null);
  const autoPlayStepRef = useRef(0);
  const sortedKeysRef = useRef<string[]>([]);

  // Check for block query parameter
  useEffect(() => {
    const blockParam = searchParams.get('block');
    if (blockParam) {
      const blockNum = parseInt(blockParam, 10);
      if (!isNaN(blockNum) && blockNum > 0) {
        setSelectedBlock(blockNum);
        setBlockInput(blockNum.toString());
      }
    }
  }, [searchParams]);

  // Fetch latest block
  const { data: latestBlock, refetch: refetchLatest, isLoading: latestLoading } = useQuery({
    queryKey: ['latest-block'],
    queryFn: fetchLatestBlock,
  });

  // Fetch relay nodes
  const { data: relayNodes = [], isLoading: nodesLoading } = useQuery({
    queryKey: ['relay-nodes'],
    queryFn: fetchRelayNodes,
  });

  // Current block to display
  const currentBlockNumber = selectedBlock || latestBlock?.block_number || 0;

  // Fetch block data for the selected block
  const { data: blockData, refetch: refetchBlock, isLoading: blockLoading, error: blockError } = useQuery({
    queryKey: ['block-data', currentBlockNumber],
    queryFn: () => fetchBlockData(currentBlockNumber),
    enabled: currentBlockNumber > 0,
  });

  // Handle block search
  const handleBlockSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const blockNum = parseInt(blockInput, 10);
    if (!isNaN(blockNum) && blockNum > 0) {
      setSelectedBlock(blockNum);
      // Update URL
      router.push(`/slot-detail?block=${blockNum}`);
    }
  };

  // Handle refresh
  const handleRefresh = () => {
    refetchLatest();
    if (currentBlockNumber > 0) {
      refetchBlock();
    }
  };

  // Navigate to previous/next block
  const goToBlock = (blockNum: number) => {
    setSelectedBlock(blockNum);
    setBlockInput(blockNum.toString());
    router.push(`/slot-detail?block=${blockNum}`);
  };

  // Sort relay details by arrival order
  const relayDetailsRaw: RelayDetail[] = blockData?.relay_details?.sort((a, b) => {
    return a.arrival_order - b.arrival_order;
  }) || [];

  // Create relay name -> node map for filtering duplicates by node.id
  // Ensure relayNodes is always an array before using forEach
  const relayNameToNode = new Map<string, RelayNode>();
  const safeRelayNodes = Array.isArray(relayNodes) ? relayNodes : [];
  safeRelayNodes.forEach(node => {
    relayNameToNode.set(node.name, node);
  });

  // Filter duplicates: if multiple relays map to same node.id, keep fastest one
  const seenNodeIds = new Set<string>();
  const relayDetails: RelayDetail[] = relayDetailsRaw.filter(detail => {
    const node = relayNameToNode.get(detail.relay_name);
    if (node) {
      // Has matching node - check for duplicate node.id
      if (seenNodeIds.has(node.id)) {
        return false; // Skip duplicate
      }
      seenNodeIds.add(node.id);
    }
    return true;
  });

  // Count matched relays
  const relayNodeNames = new Set(safeRelayNodes.map(n => n.name));
  const matchedCount = relayDetails.filter(d => relayNodeNames.has(d.relay_name)).length;
  const unmatchedCount = relayDetails.length - matchedCount;

  const loading = latestLoading || blockLoading || nodesLoading;

  // Get unique key for a relay (node.id if matched, relay_name if not)
  const getRelayKey = (relayName: string): string => {
    const node = relayNameToNode.get(relayName);
    return node ? node.id : relayName;
  };

  // Toggle relay visibility by key
  const toggleRelayVisibility = (relayName: string) => {
    const key = getRelayKey(relayName);
    setHiddenRelays(prev => {
      const newSet = new Set(prev);
      if (newSet.has(key)) {
        newSet.delete(key);
      } else {
        newSet.add(key);
      }
      return newSet;
    });
  };

  // Check if relay is visible
  const isRelayVisible = (relayName: string): boolean => {
    const key = getRelayKey(relayName);
    return !hiddenRelays.has(key);
  };

  // Show all relays
  const showAllRelays = () => {
    setHiddenRelays(new Set());
  };

  // Hide all relays
  const hideAllRelays = () => {
    setHiddenRelays(new Set(relayDetails.map(r => getRelayKey(r.relay_name))));
  };

  // Hide relays without location (no matching node)
  const hideNoLocation = () => {
    const noLocationKeys = relayDetails
      .filter(r => !relayNameToNode.has(r.relay_name))
      .map(r => getRelayKey(r.relay_name));
    setHiddenRelays(new Set(noLocationKeys));
  };

  // Show only relays with location
  const showOnlyWithLocation = () => {
    const noLocationKeys = relayDetails
      .filter(r => !relayNameToNode.has(r.relay_name))
      .map(r => getRelayKey(r.relay_name));
    setHiddenRelays(new Set(noLocationKeys));
  };

  // Get sorted relay keys by rank for auto-play
  const getSortedRelayKeys = useCallback(() => {
    return relayDetails.map(r => getRelayKey(r.relay_name));
  }, [relayDetails, relayNameToNode]);

  // Auto-play animation effect
  useEffect(() => {
    if (!isAutoPlaying) {
      if (autoPlayTimerRef.current) {
        clearInterval(autoPlayTimerRef.current);
        autoPlayTimerRef.current = null;
      }
      return;
    }

    const sortedKeys = sortedKeysRef.current;
    if (sortedKeys.length === 0) {
      setIsAutoPlaying(false);
      return;
    }

    const totalSteps = sortedKeys.length + 1; // +1 for pause at end before restart

    const runStep = () => {
      autoPlayStepRef.current += 1;
      const currentStep = autoPlayStepRef.current;

      if (currentStep > totalSteps) {
        // Reset to beginning - hide all
        autoPlayStepRef.current = 0;
        setHiddenRelays(new Set(sortedKeys));
        setAutoPlayStep(0);
        return;
      }

      if (currentStep <= sortedKeys.length) {
        // Show relays up to current step
        const keysToShow = sortedKeys.slice(0, currentStep);
        const keysToHide = sortedKeys.filter(k => !keysToShow.includes(k));
        setHiddenRelays(new Set(keysToHide));
      } else {
        // Last step - hide all before restart
        setHiddenRelays(new Set(sortedKeys));
      }

      setAutoPlayStep(currentStep);
    };

    autoPlayTimerRef.current = setInterval(runStep, autoPlayInterval);

    return () => {
      if (autoPlayTimerRef.current) {
        clearInterval(autoPlayTimerRef.current);
        autoPlayTimerRef.current = null;
      }
    };
  }, [isAutoPlaying, autoPlayInterval]);

  // Start auto-play
  const startAutoPlay = () => {
    const sortedKeys = getSortedRelayKeys();
    sortedKeysRef.current = sortedKeys;
    autoPlayStepRef.current = 0;
    setAutoPlayStep(0);
    setHiddenRelays(new Set(sortedKeys)); // Hide all first
    setIsAutoPlaying(true);
  };

  // Stop auto-play
  const stopAutoPlay = () => {
    setIsAutoPlaying(false);
    autoPlayStepRef.current = 0;
    setAutoPlayStep(0);
    if (autoPlayTimerRef.current) {
      clearInterval(autoPlayTimerRef.current);
      autoPlayTimerRef.current = null;
    }
  };

  // Filter visible relay details for the map
  const visibleRelayDetails = relayDetails.filter(r => isRelayVisible(r.relay_name));
  const visibleCount = visibleRelayDetails.length;

  return (
    <div className="h-[calc(100vh-80px)] flex flex-col">
      {/* Header */}
      <div className="flex-shrink-0 p-4 border-b bg-background">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <Link href="/slots">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back
              </Button>
            </Link>
            <MapPin className="h-8 w-8 text-primary" />
            <div>
              <h1 className="text-2xl font-bold">Slot Detail Map</h1>
              <p className="text-sm text-muted-foreground">
                {currentBlockNumber > 0 ? `Block #${currentBlockNumber}` : 'Select a block'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* Stats Pills */}
            <div className="hidden md:flex items-center gap-2 mr-4">
              <Badge variant="outline" className="gap-1">
                <Package className="h-3 w-3" />
                {relayDetails.length} Relays
              </Badge>
              {matchedCount > 0 && (
                <Badge variant="outline" className="gap-1 text-green-600 border-green-200 bg-green-50">
                  <MapPin className="h-3 w-3" />
                  {matchedCount} Mapped
                </Badge>
              )}
              {unmatchedCount > 0 && (
                <Badge variant="outline" className="gap-1 text-gray-600 border-gray-200 bg-gray-50">
                  {unmatchedCount} Unmapped
                </Badge>
              )}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefresh}
              disabled={loading}
            >
              <RefreshCw className={cn('h-4 w-4 mr-2', loading && 'animate-spin')} />
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
          {blockError ? (
            <div className="h-full flex items-center justify-center bg-yellow-50">
              <Card className="border-yellow-200 bg-yellow-50 max-w-md">
                <CardHeader>
                  <CardTitle className="text-yellow-800">Block Not Found</CardTitle>
                  <CardDescription className="text-yellow-600">
                    Block #{currentBlockNumber} does not exist or hasn&apos;t been created yet.
                  </CardDescription>
                </CardHeader>
              </Card>
            </div>
          ) : blockData ? (
            <SlotDetailMap
              relayNodes={safeRelayNodes}
              relayDetails={visibleRelayDetails}
              allRelayDetails={relayDetails}
              selectedRelay={selectedRelay}
              onRelaySelect={setSelectedRelay}
            />
          ) : (
            <div className="h-full flex items-center justify-center bg-gray-100">
              <div className="text-center">
                <MapPin className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-500">Search for a block to view relay locations</p>
              </div>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div
          className={cn(
            'flex-shrink-0 border-l bg-background transition-all duration-300 overflow-hidden',
            sidebarOpen ? 'w-96' : 'w-0'
          )}
        >
          <div className="h-full flex flex-col w-96">
            {/* Block Search */}
            <div className="p-4 border-b space-y-3">
              <form onSubmit={handleBlockSearch} className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    type="number"
                    placeholder="Block number..."
                    value={blockInput}
                    onChange={(e) => setBlockInput(e.target.value)}
                    className="pl-9 h-9"
                    min="1"
                  />
                </div>
                <Button type="submit" size="sm">Go</Button>
              </form>
              {/* Block Navigation */}
              {currentBlockNumber > 0 && (
                <div className="flex items-center justify-between">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => goToBlock(currentBlockNumber - 1)}
                    disabled={currentBlockNumber <= 1}
                  >
                    ← Prev
                  </Button>
                  <span className="text-sm text-muted-foreground">
                    #{currentBlockNumber}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => goToBlock(currentBlockNumber + 1)}
                    disabled={latestBlock && currentBlockNumber >= latestBlock.block_number}
                  >
                    Next →
                  </Button>
                </div>
              )}
              {latestBlock && (
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full"
                  onClick={() => goToBlock(latestBlock.block_number)}
                >
                  Latest Block (#{latestBlock.block_number})
                </Button>
              )}
            </div>

            {/* Block Summary */}
            {blockData && (
              <div className="p-4 border-b bg-muted/30">
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 rounded bg-green-100">
                      <Award className="h-4 w-4 text-green-600" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">First</p>
                      <p className="text-sm font-semibold truncate max-w-[100px]">
                        {relayDetails[0]?.relay_name || '-'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 rounded bg-purple-100">
                      <Zap className="h-4 w-4 text-purple-600" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Best Latency</p>
                      <p className="text-sm font-semibold">
                        {relayDetails.length > 0
                          ? `${Math.min(...relayDetails.map(r => r.latency)).toFixed(1)}ms`
                          : '-'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 rounded bg-orange-100">
                      <Timer className="h-4 w-4 text-orange-600" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Lowest Loss</p>
                      <p className="text-sm font-semibold">
                        {relayDetails.length > 0
                          ? `${Math.min(...relayDetails.map(r => r.loss)).toFixed(2)}%`
                          : '-'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 rounded bg-blue-100">
                      <Package className="h-4 w-4 text-blue-600" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Created</p>
                      <p className="text-xs font-mono">
                        {blockData.created_at ? formatUTCTimestamp(blockData.created_at) : '-'}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Visibility Controls */}
            {relayDetails.length > 0 && (
              <div className="px-4 py-2 border-b bg-muted/20 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">
                    {visibleCount} / {relayDetails.length} visible
                    {isAutoPlaying && ` (Step ${autoPlayStep})`}
                  </span>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 text-xs px-2"
                      onClick={showAllRelays}
                      disabled={isAutoPlaying}
                    >
                      <Eye className="h-3 w-3 mr-1" />
                      All
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 text-xs px-2"
                      onClick={hideAllRelays}
                      disabled={isAutoPlaying}
                    >
                      <EyeOff className="h-3 w-3 mr-1" />
                      None
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 text-xs px-2"
                      onClick={showOnlyWithLocation}
                      disabled={isAutoPlaying}
                      title="Show only relays with location"
                    >
                      <MapPin className="h-3 w-3 mr-1" />
                      With Loc
                    </Button>
                  </div>
                </div>
                {/* Auto-play Controls */}
                <div className="flex items-center gap-2">
                  {isAutoPlaying ? (
                    <Button
                      variant="destructive"
                      size="sm"
                      className="h-7 text-xs"
                      onClick={stopAutoPlay}
                    >
                      <Square className="h-3 w-3 mr-1" />
                      Stop
                    </Button>
                  ) : (
                    <Button
                      variant="default"
                      size="sm"
                      className="h-7 text-xs"
                      onClick={startAutoPlay}
                    >
                      <Play className="h-3 w-3 mr-1" />
                      Auto Play
                    </Button>
                  )}
                  <div className="flex items-center gap-1">
                    <span className="text-xs text-muted-foreground">Interval:</span>
                    <Input
                      type="number"
                      value={autoPlayInterval / 1000}
                      onChange={(e) => setAutoPlayInterval(Math.max(0.1, parseFloat(e.target.value) || 1) * 1000)}
                      className="h-7 w-16 text-xs"
                      min="0.1"
                      step="0.1"
                      disabled={isAutoPlaying}
                    />
                    <span className="text-xs text-muted-foreground">s</span>
                  </div>
                </div>
              </div>
            )}

            {/* Relay List */}
            <div className="flex-1 overflow-y-auto">
              {loading ? (
                <div className="flex items-center justify-center p-8">
                  <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : relayDetails.length === 0 ? (
                <div className="flex flex-col items-center justify-center p-8 text-center">
                  <Package className="h-8 w-8 text-muted-foreground mb-2" />
                  <p className="text-sm text-muted-foreground">No relay data</p>
                </div>
              ) : (
                <div className="divide-y">
                  {relayDetails.map((relay, index) => {
                    const rank = index + 1;
                    const node = safeRelayNodes.find(n => n.name === relay.relay_name);
                    const isMatched = !!node;
                    const isSelected = selectedRelay === relay.relay_name;
                    const isVisible = isRelayVisible(relay.relay_name);

                    return (
                      <div
                        key={relay.id}
                        className={cn(
                          'w-full p-3 hover:bg-muted/50 transition-colors flex items-center gap-2',
                          isSelected && 'bg-muted',
                          !isMatched && 'opacity-60',
                          !isVisible && 'opacity-40'
                        )}
                      >
                        {/* Visibility Checkbox */}
                        <Checkbox
                          checked={isVisible}
                          onCheckedChange={() => toggleRelayVisibility(relay.relay_name)}
                          className="flex-shrink-0"
                        />

                        <button
                          className="flex-1 text-left flex items-center gap-3"
                          onClick={() => setSelectedRelay(relay.relay_name)}
                        >
                          {/* Rank Badge */}
                          <div
                            className={cn(
                              'flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold',
                              rank === 1 && 'bg-yellow-100 text-yellow-800',
                              rank === 2 && 'bg-gray-100 text-gray-800',
                              rank === 3 && 'bg-orange-100 text-orange-800',
                              rank > 3 && 'bg-indigo-50 text-indigo-700'
                            )}
                          >
                            {rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : rank}
                          </div>

                          {/* Relay Info */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="font-medium truncate">{relay.relay_name}</p>
                              {!isMatched && (
                                <Badge variant="outline" className="text-xs bg-gray-50 text-gray-500">
                                  No location
                                </Badge>
                              )}
                            </div>
                            <div className="flex items-center gap-3 text-xs text-muted-foreground">
                              {node && (
                                <span className="truncate">
                                  {node.location || node.country || 'Unknown'}
                                </span>
                              )}
                              <span className={cn(
                                'font-mono',
                                relay.latency < 50 ? 'text-green-600' :
                                relay.latency < 100 ? 'text-yellow-600' : 'text-red-600'
                              )}>
                                {relay.latency.toFixed(1)}ms
                              </span>
                              <span className={cn(
                                'font-mono',
                                relay.loss < 0.5 ? 'text-green-600' :
                                relay.loss < 1.5 ? 'text-yellow-600' : 'text-red-600'
                              )}>
                                {relay.loss.toFixed(2)}%
                              </span>
                            </div>
                          </div>

                          {/* Map indicator */}
                          {isMatched && (
                            <MapPin className={cn(
                              'h-4 w-4 flex-shrink-0',
                              isVisible ? 'text-green-500' : 'text-gray-300'
                            )} />
                          )}
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-3 border-t text-xs text-muted-foreground text-center">
              {matchedCount} of {relayDetails.length} relays mapped
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function SlotDetailPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center p-8 h-screen">
        <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    }>
      <SlotDetailContent />
    </Suspense>
  );
}
