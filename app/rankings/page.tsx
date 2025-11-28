'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { RefreshCw, TrendingUp, Award, Zap, ChevronDown, ChevronRight, ExternalLink, Trash2, Filter } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useRouter } from 'next/navigation';

// Fetch relay statistics with rankings
async function fetchRelayStatistics(timeRange: string, blockRange?: number) {
  const params = new URLSearchParams();
  if (timeRange) params.set('timeRange', timeRange);
  if (blockRange) params.set('blockRange', blockRange.toString());

  const response = await fetch(`/api/statistics?${params.toString()}`);
  if (!response.ok) throw new Error('Failed to fetch statistics');
  const data = await response.json();
  return data.data;
}

// Fetch blocks for a specific relay
async function fetchRelayBlocks(relayName: string) {
  const response = await fetch(`/api/rankings?relayName=${encodeURIComponent(relayName)}&limit=100`);
  if (!response.ok) throw new Error('Failed to fetch relay blocks');
  const data = await response.json();
  return data.data;
}

export default function RankingsPage() {
  const router = useRouter();
  const [expandedRelay, setExpandedRelay] = useState<string | null>(null);
  const [isFlushing, setIsFlushing] = useState(false);
  const [timeRange, setTimeRange] = useState<string>('all');
  const [blockRange, setBlockRange] = useState<string>('');

  const { data: statsData, isLoading, refetch } = useQuery({
    queryKey: ['relay-statistics', timeRange, blockRange],
    queryFn: () => fetchRelayStatistics(timeRange, blockRange ? parseInt(blockRange) : undefined),
  });

  // Fetch blocks for expanded relay
  const { data: relayBlocksData, isLoading: blocksLoading } = useQuery({
    queryKey: ['relay-blocks', expandedRelay],
    queryFn: () => fetchRelayBlocks(expandedRelay!),
    enabled: !!expandedRelay,
  });

  // Sort relays by first arrival count (fastest relay wins most often)
  const rankedRelays = statsData?.statistics?.sort((a: any, b: any) => {
    return b.first_arrival_count - a.first_arrival_count;
  }) || [];

  const handleToggleExpand = (relayName: string) => {
    setExpandedRelay(expandedRelay === relayName ? null : relayName);
  };

  const handleBlockClick = (blockNumber: number) => {
    router.push(`/slots?block=${blockNumber}`);
  };

  // Flush all relay/block data
  const handleFlushData = async () => {
    const confirmed = window.confirm(
      '⚠️ WARNING: This will delete ALL relay and block data!\n\n' +
      'This includes:\n' +
      '- All blocks\n' +
      '- All relay details\n' +
      '- All relay statistics\n\n' +
      'This action cannot be undone. Are you sure you want to continue?'
    );
    
    if (!confirmed) return;
    
    setIsFlushing(true);
    try {
      const response = await fetch('/api/relays?confirm=true', {
        method: 'DELETE'
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to flush data');
      }
      // Refetch data after flush
      refetch();
      alert('All relay and block data has been deleted successfully.');
    } catch (error) {
      alert(`Error: ${error instanceof Error ? error.message : 'Failed to flush data'}`);
    } finally {
      setIsFlushing(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Section */}
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl font-bold">Relay Rankings</h1>
            <p className="text-muted-foreground">
              Overall performance rankings based on historical data
            </p>
          </div>
          <div className="flex items-center gap-2">
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
              variant="destructive"
              size="sm"
              onClick={handleFlushData}
              disabled={isFlushing || isLoading}
            >
              <Trash2 className={cn('h-4 w-4 mr-2', isFlushing && 'animate-spin')} />
              {isFlushing ? 'Flushing...' : 'Flush All Data'}
            </Button>
          </div>
        </div>

        {/* Filter Section */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Filter className="h-4 w-4" />
              Filters
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-4 md:flex-row md:items-end">
              <div className="flex-1 space-y-2">
                <label htmlFor="time-range" className="text-sm font-medium">
                  Time Range
                </label>
                <Select value={timeRange} onValueChange={setTimeRange}>
                  <SelectTrigger id="time-range">
                    <SelectValue placeholder="Select time range" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Time</SelectItem>
                    <SelectItem value="1h">Last 1 Hour</SelectItem>
                    <SelectItem value="6h">Last 6 Hours</SelectItem>
                    <SelectItem value="24h">Last 24 Hours</SelectItem>
                    <SelectItem value="7d">Last 7 Days</SelectItem>
                    <SelectItem value="30d">Last 30 Days</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex-1 space-y-2">
                <label htmlFor="block-range" className="text-sm font-medium">
                  Block Range (Last N blocks)
                </label>
                <Input
                  id="block-range"
                  type="number"
                  placeholder="e.g., 100"
                  value={blockRange}
                  onChange={(e) => setBlockRange(e.target.value)}
                  min="1"
                />
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setTimeRange('all');
                  setBlockRange('');
                }}
              >
                Clear Filters
              </Button>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Note: Block range filter takes precedence over time range if both are set.
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Summary Stats */}
      {statsData && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total Blocks Analyzed
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">
                {statsData.summary?.total_blocks?.toLocaleString() || '0'}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Active Relays
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">
                {statsData.summary?.total_unique_relays || '0'}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Avg Latency
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">
                {statsData.summary?.metrics?.overall_avg_latency?.toFixed(1) || '0'}ms
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Avg Loss
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">
                {statsData.summary?.metrics?.overall_avg_loss?.toFixed(2) || '0'}%
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Rankings Table */}
      <Card>
        <CardHeader>
          <CardTitle>Overall Rankings</CardTitle>
          <CardDescription>
            Ranked by number of times each relay sent blocks first
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center p-8">
              <div className="text-muted-foreground">Loading rankings...</div>
            </div>
          ) : rankedRelays.length === 0 ? (
            <div className="flex items-center justify-center p-8">
              <div className="text-muted-foreground">No ranking data available</div>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-20">Rank</TableHead>
                  <TableHead>Relay Name</TableHead>
                  <TableHead className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Award className="h-4 w-4" />
                      Wins
                    </div>
                  </TableHead>
                  <TableHead className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Zap className="h-4 w-4" />
                      Avg Latency
                    </div>
                  </TableHead>
                  <TableHead className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <TrendingUp className="h-4 w-4" />
                      Avg Loss
                    </div>
                  </TableHead>
                  <TableHead className="text-right">Total Blocks</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rankedRelays.map((relay: any, index: number) => (
                  <>
                    <TableRow key={relay.relay_name} className="hover:bg-muted/50">
                      <TableCell className="font-medium">
                        <span
                          className={cn(
                            'inline-flex items-center justify-center w-8 h-8 rounded-full text-xs font-bold',
                            index === 0 && 'bg-yellow-100 text-yellow-800',
                            index === 1 && 'bg-gray-100 text-gray-800',
                            index === 2 && 'bg-orange-100 text-orange-800',
                            index > 2 && 'bg-slate-100 text-slate-700'
                          )}
                        >
                          {index + 1}
                        </span>
                      </TableCell>
                      <TableCell className="font-medium">{relay.relay_name}</TableCell>
                      <TableCell className="text-right">
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                          {relay.first_arrival_count}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <span
                          className={cn(
                            'font-mono',
                            relay.avg_latency < 50 && 'text-green-600',
                            relay.avg_latency >= 50 && relay.avg_latency < 100 && 'text-yellow-600',
                            relay.avg_latency >= 100 && 'text-red-600'
                          )}
                        >
                          {relay.avg_latency.toFixed(1)}ms
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <span
                          className={cn(
                            'font-mono',
                            relay.avg_loss < 0.5 && 'text-green-600',
                            relay.avg_loss >= 0.5 && relay.avg_loss < 1.5 && 'text-yellow-600',
                            relay.avg_loss >= 1.5 && 'text-red-600'
                          )}
                        >
                          {relay.avg_loss.toFixed(2)}%
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleToggleExpand(relay.relay_name)}
                          className="hover:bg-primary/10"
                        >
                          {expandedRelay === relay.relay_name ? (
                            <ChevronDown className="h-4 w-4 mr-1" />
                          ) : (
                            <ChevronRight className="h-4 w-4 mr-1" />
                          )}
                          {relay.total_blocks}
                        </Button>
                      </TableCell>
                    </TableRow>
                    {/* Expanded row showing block list */}
                    {expandedRelay === relay.relay_name && (
                      <TableRow key={`${relay.relay_name}-expanded`}>
                        <TableCell colSpan={6} className="bg-muted/30 p-4">
                          <div className="space-y-2">
                            <h4 className="text-sm font-semibold mb-3">
                              Blocks for {relay.relay_name}
                            </h4>
                            {blocksLoading ? (
                              <div className="text-sm text-muted-foreground">Loading blocks...</div>
                            ) : relayBlocksData?.data ? (
                              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2">
                                {relayBlocksData.data
                                  .sort((a: any, b: any) => b.block_number - a.block_number)
                                  .map((block: any) => (
                                    <Button
                                      key={block.block_number}
                                      variant="outline"
                                      size="sm"
                                      onClick={() => handleBlockClick(block.block_number)}
                                      className="justify-between hover:bg-primary/10"
                                    >
                                      Block #{block.block_number}
                                      <ExternalLink className="h-3 w-3 ml-1" />
                                    </Button>
                                  ))}
                              </div>
                            ) : (
                              <div className="text-sm text-muted-foreground">No blocks found</div>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
