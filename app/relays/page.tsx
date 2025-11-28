'use client';

import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
import { RefreshCw, Award, Zap, TrendingUp, Search, AlertCircle, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';

// Fetch relay statistics - request all relays (limit=1000 to get all)
async function fetchRelayStatistics() {
  const response = await fetch('/api/statistics?limit=1000');
  if (!response.ok) throw new Error('Failed to fetch statistics');
  const data = await response.json();
  return data.data;
}

type RelayStat = {
  relay_name: string;
  total_blocks: number;
  avg_latency: number;
  avg_loss: number;
  first_arrival_count: number;
};

export default function RelaysPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'wins' | 'blocks' | 'latency' | 'name'>('wins');
  const [filterBy, setFilterBy] = useState<'all' | 'winners' | 'no-wins'>('all');

  const { data: statsData, isLoading, refetch } = useQuery({
    queryKey: ['relay-statistics'],
    queryFn: fetchRelayStatistics,
  });

  // Process and filter relays
  const processedRelays = useMemo(() => {
    if (!statsData?.statistics) return [];

    let relays: RelayStat[] = statsData.statistics.map((stat: any) => ({
      relay_name: stat.relay_name,
      total_blocks: stat.total_blocks,
      avg_latency: stat.avg_latency,
      avg_loss: stat.avg_loss,
      first_arrival_count: stat.first_arrival_count,
    }));

    // Filter by search query
    if (searchQuery) {
      relays = relays.filter((relay) =>
        relay.relay_name.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    // Filter by win status
    if (filterBy === 'winners') {
      relays = relays.filter((relay) => relay.first_arrival_count > 0);
    } else if (filterBy === 'no-wins') {
      relays = relays.filter((relay) => relay.first_arrival_count === 0);
    }

    // Sort relays
    relays.sort((a, b) => {
      switch (sortBy) {
        case 'wins':
          return b.first_arrival_count - a.first_arrival_count;
        case 'blocks':
          return b.total_blocks - a.total_blocks;
        case 'latency':
          return a.avg_latency - b.avg_latency;
        case 'name':
          return a.relay_name.localeCompare(b.relay_name);
        default:
          return 0;
      }
    });

    return relays;
  }, [statsData, searchQuery, sortBy, filterBy]);

  const relaysWithWins = useMemo(() => {
    return statsData?.statistics?.filter((r: any) => r.first_arrival_count > 0).length || 0;
  }, [statsData]);

  const relaysWithoutWins = useMemo(() => {
    return statsData?.statistics?.filter((r: any) => r.first_arrival_count === 0).length || 0;
  }, [statsData]);

  return (
    <div className="space-y-6">
      {/* Header Section */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold">All Relays Overview</h1>
          <p className="text-muted-foreground">
            Comprehensive view of all relays and their performance statistics
          </p>
        </div>
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

      {/* Summary Stats */}
      {statsData && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total Relays
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
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                Relays with Wins
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-green-600">{relaysWithWins}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-orange-600" />
                Relays with No Wins
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-orange-600">{relaysWithoutWins}</p>
            </CardContent>
          </Card>
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
        </div>
      )}

      {/* Filters and Search */}
      <Card>
        <CardHeader>
          <CardTitle>Relay Details</CardTitle>
          <CardDescription>
            View all relays and identify which ones have wins and which don&apos;t
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col md:flex-row gap-4 mb-6">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search relay name..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <Select value={filterBy} onValueChange={(value: 'all' | 'winners' | 'no-wins') => setFilterBy(value)}>
              <SelectTrigger className="w-full md:w-[180px]">
                <SelectValue placeholder="Filter by wins" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Relays</SelectItem>
                <SelectItem value="winners">With Wins</SelectItem>
                <SelectItem value="no-wins">No Wins</SelectItem>
              </SelectContent>
            </Select>
            <Select value={sortBy} onValueChange={(value: 'wins' | 'blocks' | 'latency' | 'name') => setSortBy(value)}>
              <SelectTrigger className="w-full md:w-[180px]">
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="wins">Sort by Wins</SelectItem>
                <SelectItem value="blocks">Sort by Blocks</SelectItem>
                <SelectItem value="latency">Sort by Latency</SelectItem>
                <SelectItem value="name">Sort by Name</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center p-8">
              <div className="text-muted-foreground">Loading relay data...</div>
            </div>
          ) : processedRelays.length === 0 ? (
            <div className="flex items-center justify-center p-8">
              <div className="text-muted-foreground">No relays found</div>
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Relay Name</TableHead>
                    <TableHead className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Award className="h-4 w-4" />
                        Wins
                      </div>
                    </TableHead>
                    <TableHead className="text-right">Total Blocks</TableHead>
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
                    <TableHead className="text-right">Win Rate</TableHead>
                    <TableHead className="text-center">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {processedRelays.map((relay) => {
                    const winRate = relay.total_blocks > 0 
                      ? ((relay.first_arrival_count / relay.total_blocks) * 100).toFixed(2)
                      : '0.00';
                    const hasWins = relay.first_arrival_count > 0;

                    return (
                      <TableRow
                        key={relay.relay_name}
                        className={cn(
                          'hover:bg-muted/50',
                          !hasWins && 'bg-orange-50/50'
                        )}
                      >
                        <TableCell className="font-medium">{relay.relay_name}</TableCell>
                        <TableCell className="text-right">
                          <span
                            className={cn(
                              'inline-flex items-center px-2 py-1 rounded-full text-xs font-medium',
                              hasWins
                                ? 'bg-green-100 text-green-800'
                                : 'bg-orange-100 text-orange-800'
                            )}
                          >
                            {relay.first_arrival_count}
                          </span>
                        </TableCell>
                        <TableCell className="text-right">{relay.total_blocks}</TableCell>
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
                          <span className="font-mono text-sm">{winRate}%</span>
                        </TableCell>
                        <TableCell className="text-center">
                          {hasWins ? (
                            <CheckCircle2 className="h-5 w-5 text-green-600 mx-auto" />
                          ) : (
                            <AlertCircle className="h-5 w-5 text-orange-600 mx-auto" />
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}

          {processedRelays.length > 0 && (
            <div className="mt-4 text-sm text-muted-foreground">
              Showing {processedRelays.length} of {statsData?.statistics?.length || 0} relays
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

