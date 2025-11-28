'use client';

import { useState, useMemo } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
import { RefreshCw, Award, Zap, TrendingUp, TrendingDown, Filter, RotateCcw, MapPin, BarChart3, Download, Wrench } from 'lucide-react';
import { cn } from '@/lib/utils';
import Link from 'next/link';

// Format timestamp to UTC format (H:MM:SS.mmm)
function formatUTCTimestamp(timestamp: string | Date): string {
  const date = typeof timestamp === 'string' ? new Date(timestamp) : timestamp;
  const hours = date.getUTCHours();
  const minutes = date.getUTCMinutes().toString().padStart(2, '0');
  const seconds = date.getUTCSeconds().toString().padStart(2, '0');
  const milliseconds = date.getUTCMilliseconds().toString().padStart(3, '0');
  return `${hours}:${minutes}:${seconds}.${milliseconds}`;
}

// Fetch bloxroute comparison data
async function fetchBloxrouteComparison(limit: number = 50, offset: number = 0) {
  const response = await fetch(`/api/bloxroute?limit=${limit}&offset=${offset}`);
  if (!response.ok) throw new Error('Failed to fetch bloxroute comparison');
  const data = await response.json();
  return data.data;
}

// Refresh bloxroute data for a single block
async function refreshSingleBlock(blockNumber: number) {
  const response = await fetch(`/api/relays/${blockNumber}`, {
    method: 'PATCH'
  });
  if (!response.ok) {
    const data = await response.json();
    throw new Error(data.error || 'Failed to refresh Bloxroute data');
  }
  const data = await response.json();
  return data.data;
}

// Fetch origin statistics
async function fetchOriginStats() {
  const response = await fetch('/api/bloxroute/origins');
  if (!response.ok) throw new Error('Failed to fetch origin statistics');
  const data = await response.json();
  return data.data;
}

// Fetch blocks without bloxroute data
async function fetchMissingBloxrouteBlocks() {
  const response = await fetch('/api/bloxroute/missing');
  if (!response.ok) throw new Error('Failed to fetch missing bloxroute blocks');
  const data = await response.json();
  return data.data;
}

// Sync all blocks without bloxroute data
async function syncAllBloxrouteData(blockNumbers: number[], onProgress?: (current: number, total: number) => void) {
  const results = [];
  for (let i = 0; i < blockNumbers.length; i++) {
    try {
      const response = await fetch(`/api/relays/${blockNumbers[i]}`, {
        method: 'PATCH'
      });
      if (!response.ok) {
        const data = await response.json();
        results.push({ blockNumber: blockNumbers[i], success: false, error: data.error });
      } else {
        const data = await response.json();
        results.push({ blockNumber: blockNumbers[i], success: true, data: data.data });
      }
    } catch (error) {
      results.push({ blockNumber: blockNumbers[i], success: false, error: String(error) });
    }

    if (onProgress) {
      onProgress(i + 1, blockNumbers.length);
    }
  }
  return results;
}

export default function BloxroutePage() {
  const [limit] = useState(50);
  const [offset, setOffset] = useState(0);
  const [searchTerm, setSearchTerm] = useState('');
  const [resultFilter, setResultFilter] = useState<'all' | 'relay' | 'bloxroute'>('all');
  const [sortBy, setSortBy] = useState<'block' | 'time'>('block');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [showOriginModal, setShowOriginModal] = useState(false);
  const [refreshingBlock, setRefreshingBlock] = useState<number | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncProgress, setSyncProgress] = useState({ current: 0, total: 0 });
  const [showSyncDialog, setShowSyncDialog] = useState(false);
  const [syncTitle, setSyncTitle] = useState('Syncing Bloxroute Data');

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['bloxroute-comparison', limit, offset],
    queryFn: () => fetchBloxrouteComparison(limit, offset),
  });

  // Mutation for refreshing single block Bloxroute data
  const refreshBlockMutation = useMutation({
    mutationFn: (blockNumber: number) => {
      setRefreshingBlock(blockNumber);
      return refreshSingleBlock(blockNumber);
    },
    onSuccess: () => {
      // Refetch the comparison data after successful refresh
      refetch();
    },
    onSettled: () => {
      // Clear refreshing state when done (success or error)
      setRefreshingBlock(null);
    }
  });

  // Query for origin statistics
  const { data: originData, isLoading: originLoading } = useQuery({
    queryKey: ['origin-stats'],
    queryFn: fetchOriginStats,
    enabled: showOriginModal, // Only fetch when modal is opened
  });

  const rawComparisons = data?.comparisons || [];
  const statistics = data?.statistics || null;
  const pagination = data?.pagination || null;

  // Filter and sort comparisons
  const comparisons = useMemo(() => {
    let filtered = [...rawComparisons];

    // Search filter
    if (searchTerm) {
      filtered = filtered.filter((c: any) =>
        c.block_number.toString().includes(searchTerm) ||
        c.first_relay_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.bloxroute_origin?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Result filter
    if (resultFilter === 'relay') {
      filtered = filtered.filter((c: any) => c.relay_won);
    } else if (resultFilter === 'bloxroute') {
      filtered = filtered.filter((c: any) => !c.relay_won);
    }

    // Sort
    filtered.sort((a: any, b: any) => {
      if (sortBy === 'block') {
        return sortOrder === 'asc'
          ? a.block_number - b.block_number
          : b.block_number - a.block_number;
      } else {
        return sortOrder === 'asc'
          ? a.time_difference_ms - b.time_difference_ms
          : b.time_difference_ms - a.time_difference_ms;
      }
    });

    return filtered;
  }, [rawComparisons, searchTerm, resultFilter, sortBy, sortOrder]);

  const handlePrevPage = () => {
    if (offset > 0) {
      setOffset(Math.max(0, offset - limit));
    }
  };

  const handleNextPage = () => {
    if (pagination?.hasMore) {
      setOffset(offset + limit);
    }
  };

  const handleSyncAll = async () => {
    try {
      setIsSyncing(true);
      setShowSyncDialog(true);
      setSyncTitle('Syncing Missing Bloxroute Data');

      // Fetch blocks without bloxroute data
      const missingData = await fetchMissingBloxrouteBlocks();
      const blockNumbers = missingData.blockNumbers;

      if (blockNumbers.length === 0) {
        alert('No blocks missing bloxroute data!');
        setIsSyncing(false);
        setShowSyncDialog(false);
        return;
      }

      setSyncProgress({ current: 0, total: blockNumbers.length });

      // Sync all blocks
      await syncAllBloxrouteData(blockNumbers, (current, total) => {
        setSyncProgress({ current, total });
      });

      // Refresh the data after sync
      await refetch();

      setIsSyncing(false);
      setTimeout(() => setShowSyncDialog(false), 2000);
    } catch (error) {
      console.error('Error syncing bloxroute data:', error);
      alert('Failed to sync bloxroute data');
      setIsSyncing(false);
      setShowSyncDialog(false);
    }
  };

  const handleFixHighDiff = async () => {
    try {
      // Fetch ALL high diff blocks from the database (not just current page)
      const response = await fetch('/api/bloxroute/high-diff');
      if (!response.ok) throw new Error('Failed to fetch high diff blocks');
      const data = await response.json();
      const highDiffBlocks = data.data.blockNumbers || [];

      if (highDiffBlocks.length === 0) {
        alert('No blocks with high time difference (> 300ms) found in the entire database!');
        return;
      }

      if (!confirm(`Found ${highDiffBlocks.length} blocks with high time difference (> 300ms) across the entire database.\n\nRemove Bloxroute data from all these blocks?\n\nThis will clear the Bloxroute comparison data for these blocks.`)) {
        return;
      }

      setIsSyncing(true);
      setShowSyncDialog(true);
      setSyncTitle(`Removing High Diff Blocks (${highDiffBlocks.length})`);
      setSyncProgress({ current: 0, total: highDiffBlocks.length });

      // Remove each block
      for (let i = 0; i < highDiffBlocks.length; i++) {
        const blockNumber = highDiffBlocks[i];
        await fetch(`/api/bloxroute/high-diff/delete?blockNumber=${blockNumber}`, {
          method: 'DELETE'
        });
        setSyncProgress({ current: i + 1, total: highDiffBlocks.length });
      }

      // Refresh the data
      await refetch();

      setIsSyncing(false);
      setTimeout(() => setShowSyncDialog(false), 2000);
    } catch (error) {
      console.error('Error removing high diff blocks:', error);
      alert('Failed to remove high diff blocks');
      setIsSyncing(false);
      setShowSyncDialog(false);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8 space-y-6">
      {/* Header Section */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold">Bloxroute Comparison</h1>
          <p className="text-muted-foreground">
            Compare first relay arrival time vs Bloxroute for all blocks
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/slots">
            <Button variant="outline" size="sm">
              <Zap className="h-4 w-4 mr-2" />
              View Slots
            </Button>
          </Link>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowOriginModal(true)}
          >
            <MapPin className="h-4 w-4 mr-2" />
            Analysis Location
          </Button>
          <Button
            variant="default"
            size="sm"
            onClick={handleSyncAll}
            disabled={isSyncing || isLoading}
          >
            <Download className={cn('h-4 w-4 mr-2', isSyncing && 'animate-bounce')} />
            Sync All Missing
          </Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={handleFixHighDiff}
            disabled={isSyncing || isLoading}
          >
            <Wrench className={cn('h-4 w-4 mr-2', isSyncing && 'animate-spin')} />
            Fix High Diff
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
        </div>
      </div>

      {/* Statistics Summary */}
      {statistics && (
        <Card>
          <CardHeader>
            <CardTitle>Overall Statistics</CardTitle>
            <CardDescription>
              Win/loss statistics across all blocks with Bloxroute data
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-blue-100">
                  <Award className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Blocks</p>
                  <p className="text-2xl font-bold">{statistics.total}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-green-100">
                  <TrendingUp className="h-5 w-5 text-green-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Relay Wins</p>
                  <p className="text-2xl font-bold text-green-600">{statistics.relay_wins}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-red-100">
                  <TrendingDown className="h-5 w-5 text-red-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Bloxroute Wins</p>
                  <p className="text-2xl font-bold text-red-600">{statistics.bloxroute_wins}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-purple-100">
                  <Zap className="h-5 w-5 text-purple-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Win Rate</p>
                  <p className="text-2xl font-bold text-purple-600">
                    {statistics.relay_win_rate.toFixed(1)}%
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-orange-100">
                  <Zap className="h-5 w-5 text-orange-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Avg Time Diff</p>
                  <p className={cn(
                    'text-2xl font-bold',
                    statistics.avg_time_difference_ms < 0 ? 'text-green-600' : 'text-red-600'
                  )}>
                    {statistics.avg_time_difference_ms.toFixed(0)}ms
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Comparison Table */}
      <Card>
        <CardHeader>
          <CardTitle>Block Comparisons</CardTitle>
          <CardDescription>
            Detailed comparison of first relay vs Bloxroute for each block
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Filter Controls */}
          <div className="mb-4 space-y-3">
            <div className="flex flex-wrap gap-3">
              {/* Search Input */}
              <div className="flex-1 min-w-[250px]">
                <Input
                  placeholder="Search by block #, relay name, or origin..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full"
                />
              </div>

              {/* Result Filter */}
              <Select value={resultFilter} onValueChange={(value: any) => setResultFilter(value)}>
                <SelectTrigger className="w-[180px]">
                  <Filter className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Filter by result" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Results</SelectItem>
                  <SelectItem value="relay">🏆 Relay Won</SelectItem>
                  <SelectItem value="bloxroute">⚡ Bloxroute Won</SelectItem>
                </SelectContent>
              </Select>

              {/* Sort By */}
              <Select value={sortBy} onValueChange={(value: any) => setSortBy(value)}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="Sort by" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="block">Block Number</SelectItem>
                  <SelectItem value="time">Time Difference</SelectItem>
                </SelectContent>
              </Select>

              {/* Sort Order */}
              <Select value={sortOrder} onValueChange={(value: any) => setSortOrder(value)}>
                <SelectTrigger className="w-[130px]">
                  <SelectValue placeholder="Order" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="desc">Descending</SelectItem>
                  <SelectItem value="asc">Ascending</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Filter className="h-4 w-4" />
              <span>Showing {comparisons.length} of {rawComparisons.length} blocks</span>
            </div>
          </div>
          {isLoading ? (
            <div className="flex items-center justify-center p-8">
              <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
              <p className="ml-2 text-muted-foreground">Loading...</p>
            </div>
          ) : comparisons.length === 0 ? (
            <div className="flex items-center justify-center p-8">
              <p className="text-muted-foreground">No comparison data available</p>
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-32">Block #</TableHead>
                    <TableHead>First Relay</TableHead>
                    <TableHead className="text-right">Relay Time</TableHead>
                    <TableHead>Bloxroute Origin</TableHead>
                    <TableHead className="text-right">Bloxroute Time</TableHead>
                    <TableHead className="text-right">Time Diff</TableHead>
                    <TableHead className="text-center">Result</TableHead>
                    <TableHead className="text-center w-24">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {comparisons.map((comparison: any) => (
                    <TableRow key={comparison.block_number}>
                      <TableCell>
                        <Link
                          href={`/slots?block=${comparison.block_number}`}
                          className="font-mono font-semibold text-blue-600 hover:underline"
                        >
                          #{comparison.block_number}
                        </Link>
                      </TableCell>
                      <TableCell className="font-medium">
                        {comparison.first_relay_name}
                      </TableCell>
                      <TableCell className="text-right">
                        <span className="text-sm font-mono text-slate-700">
                          {formatUTCTimestamp(comparison.first_relay_timestamp)}
                        </span>
                      </TableCell>
                      <TableCell className="font-medium text-slate-600">
                        {comparison.bloxroute_origin}
                      </TableCell>
                      <TableCell className="text-right">
                        <span className="text-sm font-mono text-slate-700">
                          {formatUTCTimestamp(comparison.bloxroute_timestamp)}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <span className={cn(
                          'font-mono font-bold text-base',
                          comparison.time_difference_ms < 0 ? 'text-green-600' : 'text-red-600'
                        )}>
                          {comparison.time_difference_ms < 0 ? '-' : '+'}
                          {Math.abs(comparison.time_difference_ms)}ms
                        </span>
                      </TableCell>
                      <TableCell className="text-center">
                        {comparison.relay_won ? (
                          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                            🏆 Relay Won
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
                            ⚡ Bloxroute Won
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => refreshBlockMutation.mutate(comparison.block_number)}
                          disabled={refreshingBlock !== null}
                          className="h-8 w-8 p-0"
                          title="Refresh block"
                        >
                          <RotateCcw className={cn(
                            'h-4 w-4',
                            refreshingBlock === comparison.block_number && 'animate-spin'
                          )} />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {/* Pagination */}
              {pagination && (
                <div className="flex items-center justify-between mt-4 pt-4 border-t">
                  <div className="text-sm text-muted-foreground">
                    Showing {offset + 1} - {Math.min(offset + limit, pagination.total)} of {pagination.total} blocks
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handlePrevPage}
                      disabled={offset === 0}
                    >
                      Previous
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleNextPage}
                      disabled={!pagination.hasMore}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Origin Analysis Modal */}
      <Dialog open={showOriginModal} onOpenChange={setShowOriginModal}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MapPin className="h-5 w-5" />
              Bloxroute Origin Analysis
            </DialogTitle>
            <DialogDescription>
              Distribution of block origins from Bloxroute BDN network
            </DialogDescription>
          </DialogHeader>

          {originLoading ? (
            <div className="flex items-center justify-center p-8">
              <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
              <p className="ml-2 text-muted-foreground">Loading origin statistics...</p>
            </div>
          ) : originData ? (
            <div className="space-y-6">
              {/* Summary Stats */}
              <div className="grid grid-cols-2 gap-4">
                <Card>
                  <CardContent className="pt-6">
                    <div className="text-center">
                      <p className="text-sm text-muted-foreground">Total Blocks</p>
                      <p className="text-3xl font-bold">{originData.total_blocks}</p>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6">
                    <div className="text-center">
                      <p className="text-sm text-muted-foreground">Unique Origins</p>
                      <p className="text-3xl font-bold">{originData.unique_origins}</p>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Origin Statistics */}
              <div className="space-y-3">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <BarChart3 className="h-5 w-5" />
                  Origin Distribution
                </h3>
                {originData.origins && originData.origins.length > 0 ? (
                  <div className="space-y-4">
                    {originData.origins.map((origin: any, index: number) => (
                      <div key={origin.origin} className="space-y-3 p-4 rounded-lg border bg-card">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className={cn(
                              'inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold',
                              index === 0 && 'bg-yellow-100 text-yellow-800',
                              index === 1 && 'bg-gray-200 text-gray-700',
                              index === 2 && 'bg-orange-100 text-orange-700',
                              index > 2 && 'bg-blue-100 text-blue-700'
                            )}>
                              {index + 1}
                            </span>
                            <span className="font-medium">{origin.origin}</span>
                          </div>
                          <div className="text-right">
                            <span className="font-bold text-lg">{origin.count}</span>
                            <span className="text-sm text-muted-foreground ml-2">
                              ({origin.percentage.toFixed(1)}%)
                            </span>
                          </div>
                        </div>

                        {/* Block Distribution Progress Bar */}
                        <div className="space-y-1">
                          <div className="text-xs text-muted-foreground">Block Distribution</div>
                          <div className="w-full bg-gray-200 rounded-full h-2">
                            <div
                              className={cn(
                                'h-2 rounded-full',
                                index === 0 && 'bg-yellow-500',
                                index === 1 && 'bg-gray-400',
                                index === 2 && 'bg-orange-500',
                                index > 2 && 'bg-blue-500'
                              )}
                              style={{ width: `${origin.percentage}%` }}
                            ></div>
                          </div>
                        </div>

                        {/* Win/Loss Statistics */}
                        <div className="grid grid-cols-2 gap-3 pt-2 border-t">
                          <div className="space-y-1">
                            <div className="flex items-center justify-between text-xs">
                              <span className="text-muted-foreground">🏆 Relay Won</span>
                              <span className="font-semibold text-green-700">
                                {origin.relay_win_percentage.toFixed(1)}%
                              </span>
                            </div>
                            <div className="w-full bg-gray-200 rounded-full h-1.5">
                              <div
                                className="bg-green-500 h-1.5 rounded-full"
                                style={{ width: `${origin.relay_win_percentage}%` }}
                              ></div>
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {origin.relay_wins} blocks
                            </div>
                          </div>
                          <div className="space-y-1">
                            <div className="flex items-center justify-between text-xs">
                              <span className="text-muted-foreground">⚡ Bloxroute Won</span>
                              <span className="font-semibold text-red-700">
                                {origin.bloxroute_win_percentage.toFixed(1)}%
                              </span>
                            </div>
                            <div className="w-full bg-gray-200 rounded-full h-1.5">
                              <div
                                className="bg-red-500 h-1.5 rounded-full"
                                style={{ width: `${origin.bloxroute_win_percentage}%` }}
                              ></div>
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {origin.bloxroute_wins} blocks
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-center text-muted-foreground py-8">
                    No origin data available
                  </p>
                )}
              </div>
            </div>
          ) : (
            <p className="text-center text-muted-foreground py-8">
              Failed to load origin statistics
            </p>
          )}
        </DialogContent>
      </Dialog>

      {/* Sync Progress Dialog */}
      <Dialog open={showSyncDialog} onOpenChange={setShowSyncDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {syncTitle.includes('Fix') ? (
                <Wrench className={cn('h-5 w-5', isSyncing && 'animate-spin')} />
              ) : (
                <Download className={cn('h-5 w-5', isSyncing && 'animate-bounce')} />
              )}
              {syncTitle}
            </DialogTitle>
            <DialogDescription>
              {syncTitle.includes('Removing')
                ? 'Clearing bloxroute data for blocks with abnormal time differences (>300ms)'
                : syncTitle.includes('Fix')
                ? 'Re-fetching bloxroute data for blocks with high time difference (>300ms)'
                : 'Fetching bloxroute data for all blocks that are missing it'
              }
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Progress</span>
                <span className="font-medium">
                  {syncProgress.current} / {syncProgress.total}
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2.5">
                <div
                  className="bg-blue-600 h-2.5 rounded-full transition-all duration-300"
                  style={{
                    width: `${syncProgress.total > 0 ? (syncProgress.current / syncProgress.total) * 100 : 0}%`
                  }}
                ></div>
              </div>
            </div>

            {!isSyncing && syncProgress.current === syncProgress.total && syncProgress.total > 0 && (
              <div className="flex items-center gap-2 text-green-600 text-sm">
                <Award className="h-4 w-4" />
                <span>Sync completed successfully!</span>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
