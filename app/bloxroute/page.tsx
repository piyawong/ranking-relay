'use client';

import React, { useState, useMemo, useEffect } from 'react';
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
import { RefreshCw, Award, Zap, TrendingUp, TrendingDown, Filter, RotateCcw, MapPin, BarChart3, Download, Wrench, Calendar, X, Hash, ChevronDown, ChevronRight, Globe, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import { LineChart as RechartsLineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ComposedChart } from 'recharts';

// Multi-select dropdown component
function MultiSelectDropdown({
  value,
  onChange,
  options,
  placeholder,
  icon: Icon,
}: {
  value: string[];
  onChange: (values: string[]) => void;
  options: string[];
  placeholder: string;
  icon?: React.ElementType;
}) {
  const [isOpen, setIsOpen] = useState(false);

  const handleSelect = (option: string) => {
    const newValue = value.includes(option)
      ? value.filter(v => v !== option)
      : [...value, option];
    onChange(newValue);
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center justify-between w-full px-3 py-2 text-sm border rounded-md bg-white hover:bg-gray-50"
      >
        <div className="flex items-center gap-2">
          {Icon && <Icon className="h-4 w-4" />}
          <span className={cn(value.length === 0 && "text-muted-foreground")}>
            {value.length === 0 ? placeholder : `${value.length} excluded`}
          </span>
        </div>
        {value.length > 0 && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onChange([]);
            }}
            className="p-0.5 hover:bg-gray-100 rounded"
          >
            <X className="h-3 w-3" />
          </button>
        )}
      </button>

      {isOpen && (
        <div className="absolute z-50 top-full mt-1 w-full max-h-60 overflow-auto bg-white border rounded-md shadow-lg">
          {options.map(option => (
            <label
              key={option}
              className="flex items-center gap-2 px-3 py-2 hover:bg-gray-50 cursor-pointer"
            >
              <input
                type="checkbox"
                checked={value.includes(option)}
                onChange={() => handleSelect(option)}
                className="rounded"
              />
              <span className="text-sm">{option}</span>
            </label>
          ))}
        </div>
      )}
    </div>
  );
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

// Fetch bloxroute comparison data
async function fetchBloxrouteComparison(
  limit: number,
  offset: number,
  filters: {
    lastBlocks?: number;
    location?: string;
    excludeLocations?: string[];
    excludeRelays?: string[];
    blockRangeStart?: number;
    blockRangeEnd?: number;
    dateFrom?: string;
    dateTo?: string;
  }
) {
  const params = new URLSearchParams({
    limit: limit.toString(),
    offset: offset.toString(),
  });

  if (filters.lastBlocks) {
    params.append('lastBlocks', filters.lastBlocks.toString());
  }
  if (filters.location && filters.location !== 'all') {
    params.append('location', filters.location);
  }
  if (filters.excludeLocations && filters.excludeLocations.length > 0) {
    params.append('excludeLocations', filters.excludeLocations.join(','));
  }
  if (filters.excludeRelays && filters.excludeRelays.length > 0) {
    params.append('excludeRelays', filters.excludeRelays.join(','));
  }
  if (filters.blockRangeStart !== undefined) {
    params.append('blockRangeStart', filters.blockRangeStart.toString());
  }
  if (filters.blockRangeEnd !== undefined) {
    params.append('blockRangeEnd', filters.blockRangeEnd.toString());
  }
  if (filters.dateFrom) {
    params.append('dateFrom', filters.dateFrom);
  }
  if (filters.dateTo) {
    params.append('dateTo', filters.dateTo);
  }

  const response = await fetch(`/api/bloxroute?${params.toString()}`);
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
async function fetchOriginStats(filters?: {
  blockRangeStart?: number;
  blockRangeEnd?: number;
  lastBlocks?: number;
  location?: string;
  excludeLocations?: string[];
  excludeRelays?: string[];
  dateFrom?: string;
  dateTo?: string;
}) {
  const params = new URLSearchParams();

  if (filters?.blockRangeStart !== undefined) {
    params.append('blockRangeStart', filters.blockRangeStart.toString());
  }
  if (filters?.blockRangeEnd !== undefined) {
    params.append('blockRangeEnd', filters.blockRangeEnd.toString());
  }
  if (filters?.lastBlocks !== undefined) {
    params.append('lastBlocks', filters.lastBlocks.toString());
  }
  if (filters?.location && filters.location !== 'all') {
    params.append('location', filters.location);
  }
  if (filters?.excludeLocations && filters.excludeLocations.length > 0) {
    params.append('excludeLocations', filters.excludeLocations.join(','));
  }
  if (filters?.excludeRelays && filters.excludeRelays.length > 0) {
    params.append('excludeRelays', filters.excludeRelays.join(','));
  }
  if (filters?.dateFrom) {
    params.append('dateFrom', filters.dateFrom);
  }
  if (filters?.dateTo) {
    params.append('dateTo', filters.dateTo);
  }

  const url = params.toString() ? `/api/bloxroute/origins?${params}` : '/api/bloxroute/origins';
  const response = await fetch(url);
  if (!response.ok) throw new Error('Failed to fetch origin statistics');
  const data = await response.json();
  return data.data;
}

// Fetch relay performance statistics
async function fetchRelayPerformance(filters?: {
  blockRangeStart?: number;
  blockRangeEnd?: number;
  lastBlocks?: number;
  location?: string;
  excludeLocations?: string[];
  excludeRelays?: string[];
  dateFrom?: string;
  dateTo?: string;
}) {
  const params = new URLSearchParams();

  if (filters?.blockRangeStart !== undefined) {
    params.append('blockRangeStart', filters.blockRangeStart.toString());
  }
  if (filters?.blockRangeEnd !== undefined) {
    params.append('blockRangeEnd', filters.blockRangeEnd.toString());
  }
  if (filters?.lastBlocks !== undefined) {
    params.append('lastBlocks', filters.lastBlocks.toString());
  }
  if (filters?.location && filters.location !== 'all') {
    params.append('location', filters.location);
  }
  if (filters?.excludeLocations && filters.excludeLocations.length > 0) {
    params.append('excludeLocations', filters.excludeLocations.join(','));
  }
  if (filters?.excludeRelays && filters.excludeRelays.length > 0) {
    params.append('excludeRelays', filters.excludeRelays.join(','));
  }
  if (filters?.dateFrom) {
    params.append('dateFrom', filters.dateFrom);
  }
  if (filters?.dateTo) {
    params.append('dateTo', filters.dateTo);
  }

  const url = params.toString() ? `/api/bloxroute/relay-performance?${params}` : '/api/bloxroute/relay-performance';
  const response = await fetch(url);
  if (!response.ok) throw new Error('Failed to fetch relay performance');
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

// Fetch unique relay names for exclude filter
async function fetchUniqueRelayNames() {
  const response = await fetch('/api/relays?uniqueNames=true');
  if (!response.ok) throw new Error('Failed to fetch relay names');
  const data = await response.json();
  return data.data?.relayNames || [];
}

export default function BloxroutePage() {
  const [limit, setLimit] = useState(500);
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
  const [lastBlocksFilter, setLastBlocksFilter] = useState<string>('500');
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());
  const [propagationData, setPropagationData] = useState<Record<number, any>>({});
  const [locationFilter, setLocationFilter] = useState<string>('all');

  // New advanced filter states
  const [excludeLocations, setExcludeLocations] = useState<string[]>([]);
  const [excludeRelays, setExcludeRelays] = useState<string[]>([]);
  const [filterMode, setFilterMode] = useState<'lastBlocks' | 'range' | 'date'>('lastBlocks');
  const [blockRangeStart, setBlockRangeStart] = useState<string>('');
  const [blockRangeEnd, setBlockRangeEnd] = useState<string>('');
  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');

  // Origin Analysis filter states
  const [originFilterMode, setOriginFilterMode] = useState<'all' | 'lastBlocks' | 'range'>('all');
  const [originLastBlocks, setOriginLastBlocks] = useState<string>('1000');
  const [originBlockStart, setOriginBlockStart] = useState<string>('');
  const [originBlockEnd, setOriginBlockEnd] = useState<string>('');

  // Build filters object
  const filters = useMemo(() => {
    const f: any = {
      excludeLocations,
      excludeRelays,
    };

    if (filterMode === 'lastBlocks' && lastBlocksFilter !== 'all') {
      f.lastBlocks = parseInt(lastBlocksFilter);
    } else if (filterMode === 'range' && blockRangeStart && blockRangeEnd) {
      f.blockRangeStart = parseInt(blockRangeStart);
      f.blockRangeEnd = parseInt(blockRangeEnd);
    } else if (filterMode === 'date' && (dateFrom || dateTo)) {
      if (dateFrom) f.dateFrom = dateFrom;
      if (dateTo) f.dateTo = dateTo;
    }

    if (locationFilter !== 'all') {
      f.location = locationFilter;
    }

    return f;
  }, [filterMode, lastBlocksFilter, blockRangeStart, blockRangeEnd, dateFrom, dateTo, locationFilter, excludeLocations, excludeRelays]);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['bloxroute-comparison', limit, offset, filters],
    queryFn: () => fetchBloxrouteComparison(limit, offset, filters),
  });

  // Query for unique relay names
  const { data: relayNames } = useQuery({
    queryKey: ['unique-relay-names'],
    queryFn: fetchUniqueRelayNames,
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

  // Origin analysis filters
  const originFilters = useMemo(() => {
    if (originFilterMode === 'lastBlocks' && originLastBlocks) {
      return { lastBlocks: parseInt(originLastBlocks) };
    } else if (originFilterMode === 'range' && originBlockStart && originBlockEnd) {
      return {
        blockRangeStart: parseInt(originBlockStart),
        blockRangeEnd: parseInt(originBlockEnd),
      };
    }
    return undefined;
  }, [originFilterMode, originLastBlocks, originBlockStart, originBlockEnd]);

  // Query for origin statistics (for modal)
  const { data: originData, isLoading: originLoading, refetch: refetchOrigins } = useQuery({
    queryKey: ['origin-stats', originFilters],
    queryFn: () => fetchOriginStats(originFilters),
    enabled: showOriginModal, // Only fetch when modal is opened
  });

  // Query for location performance (for main page bar chart)
  const { data: locationPerformanceData, isLoading: locationPerformanceLoading } = useQuery({
    queryKey: ['location-performance', filters],
    queryFn: () => fetchOriginStats(filters),
  });

  // Query for relay performance (for main page bar chart)
  const { data: relayPerformanceData, isLoading: relayPerformanceLoading } = useQuery({
    queryKey: ['relay-performance', filters],
    queryFn: () => fetchRelayPerformance(filters),
  });

  // Query for available locations (always fetch for filter dropdown)
  const { data: availableLocations } = useQuery({
    queryKey: ['origin-locations'],
    queryFn: async () => {
      const data = await fetchOriginStats();
      return data.origins.map((o: any) => o.origin);
    },
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

  // Calculate winrate analysis data for chart
  interface WinrateChartData {
    range: string;
    blockStart: number;
    relayWinRate: number;
    bloxrouteWinRate: number;
    totalBlocks: number;
    relayWins: number;
    bloxrouteWins: number;
  }

  // Fetch data specifically for the chart - respects current filters
  const { data: chartData } = useQuery({
    queryKey: ['bloxroute-chart-data', filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.append('limit', '1000');
      params.append('offset', '0');

      // Apply current filters to chart data
      if (filters.lastBlocks) {
        params.append('lastBlocks', filters.lastBlocks.toString());
      }
      if (filters.blockRangeStart) {
        params.append('blockRangeStart', filters.blockRangeStart.toString());
      }
      if (filters.blockRangeEnd) {
        params.append('blockRangeEnd', filters.blockRangeEnd.toString());
      }
      if (filters.dateFrom) {
        params.append('dateFrom', filters.dateFrom);
      }
      if (filters.dateTo) {
        params.append('dateTo', filters.dateTo);
      }
      if (filters.location) {
        params.append('location', filters.location);
      }
      if (filters.excludeLocations && filters.excludeLocations.length > 0) {
        params.append('excludeLocations', filters.excludeLocations.join(','));
      }
      if (filters.excludeRelays && filters.excludeRelays.length > 0) {
        params.append('excludeRelays', filters.excludeRelays.join(','));
      }

      const response = await fetch(`/api/bloxroute?${params.toString()}`);
      if (!response.ok) return null;
      const result = await response.json();
      return result.data?.comparisons || [];
    },
    refetchInterval: 60000, // Refresh every minute
  });

  const winrateChartData = useMemo(() => {
    // Use dedicated chart data if available, otherwise fall back to current page data
    const dataSource = chartData && chartData.length > 0 ? chartData : rawComparisons;

    if (!dataSource || dataSource.length === 0) return [];

    // Sort comparisons by block number
    const sorted = [...dataSource].sort((a: { block_number: number }, b: { block_number: number }) => a.block_number - b.block_number);

    // Group blocks into intervals (every 100 blocks)
    const intervalSize = 100;
    const intervals: WinrateChartData[] = [];

    for (let i = 0; i < sorted.length; i += intervalSize) {
      const intervalBlocks = sorted.slice(i, i + intervalSize);
      if (intervalBlocks.length === 0) continue;

      const relayWins = intervalBlocks.filter((b: { relay_won: boolean }) => b.relay_won === true).length;
      const bloxrouteWins = intervalBlocks.filter((b: { relay_won: boolean }) => b.relay_won === false).length;
      const total = intervalBlocks.length;

      const firstBlock = intervalBlocks[0].block_number;
      const lastBlock = intervalBlocks[intervalBlocks.length - 1].block_number;

      intervals.push({
        range: `${firstBlock}`,
        blockStart: firstBlock,
        relayWinRate: total > 0 ? (relayWins / total) * 100 : 0,
        bloxrouteWinRate: total > 0 ? (bloxrouteWins / total) * 100 : 0,
        totalBlocks: total,
        relayWins,
        bloxrouteWins
      });
    }

    // Limit to most recent 20 intervals for better readability
    const maxIntervals = 20;
    if (intervals.length > maxIntervals) {
      return intervals.slice(-maxIntervals);
    }

    return intervals;
  }, [chartData, rawComparisons]);

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

  // Fetch propagation data for a slot
  const fetchPropagationData = async (slot: number) => {
    if (propagationData[slot]) return; // Already fetched

    try {
      const response = await fetch(`/api/ethpandaops/${slot}`);
      if (response.ok) {
        const data = await response.json();
        setPropagationData(prev => ({ ...prev, [slot]: data.data }));
      }
    } catch (error) {
      console.error('Failed to fetch propagation data:', error);
    }
  };

  // Toggle row expansion
  const toggleRowExpansion = (blockNumber: number) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(blockNumber)) {
      newExpanded.delete(blockNumber);
    } else {
      newExpanded.add(blockNumber);
      fetchPropagationData(blockNumber);
    }
    setExpandedRows(newExpanded);
  };

  // Reset pagination when filters change
  useEffect(() => {
    setOffset(0);
  }, [filters, limit]);

  // Auto-fetch pandaops data for all visible blocks
  useEffect(() => {
    if (comparisons && comparisons.length > 0) {
      // Fetch pandaops data for blocks we don't have yet (limit to first 50 to avoid too many requests)
      const blocksToFetch = comparisons
        .slice(0, 50)
        .filter((c: any) => !propagationData[c.block_number])
        .map((c: any) => c.block_number);

      // Fetch in batches to avoid overwhelming the API
      const fetchBatch = async () => {
        for (const blockNumber of blocksToFetch) {
          if (!propagationData[blockNumber]) {
            await fetchPropagationData(blockNumber);
            // Small delay to avoid rate limiting
            await new Promise(resolve => setTimeout(resolve, 50));
          }
        }
      };

      if (blocksToFetch.length > 0) {
        fetchBatch();
      }
    }
  }, [comparisons]);

  return (
    <div className="container mx-auto px-0 md:px-4 py-8 space-y-6">
      {/* Header Section */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold">Bloxroute Comparison</h1>
          <p className="text-muted-foreground">
            Compare first relay arrival time vs Bloxroute for all blocks
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
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
                    {statistics.avg_time_difference_ms != null ? Number(statistics.avg_time_difference_ms).toFixed(0) : '0'}ms
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Winrate Analysis Chart */}
      {winrateChartData && winrateChartData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Win Rate Analysis</CardTitle>
            <CardDescription>
              Win rate trend over block intervals (grouped by 100 blocks)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[400px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <RechartsLineChart
                  data={winrateChartData}
                  margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
                  <XAxis
                    dataKey="range"
                    tick={{ fontSize: 12 }}
                    angle={-45}
                    textAnchor="end"
                    height={60}
                  />
                  <YAxis
                    tick={{ fontSize: 12 }}
                    label={{ value: 'Win Rate (%)', angle: -90, position: 'insideLeft' }}
                    domain={[0, 100]}
                  />
                  <Tooltip
                    formatter={(value: number) => `${value.toFixed(1)}%`}
                    contentStyle={{
                      backgroundColor: 'rgba(255, 255, 255, 0.95)',
                      border: '1px solid #ccc',
                      borderRadius: '4px'
                    }}
                    labelFormatter={(label) => `Block ${label}`}
                  />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="relayWinRate"
                    stroke="#10b981"
                    strokeWidth={2}
                    name="Relay Win Rate"
                    dot={{ r: 3 }}
                    activeDot={{ r: 5 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="bloxrouteWinRate"
                    stroke="#ef4444"
                    strokeWidth={2}
                    name="Bloxroute Win Rate"
                    dot={{ r: 3 }}
                    activeDot={{ r: 5 }}
                  />
                </RechartsLineChart>
              </ResponsiveContainer>
            </div>

            {/* Additional Statistics for Chart */}
            <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
              <div className="flex items-center justify-between p-2 bg-gray-50 rounded">
                <span className="text-muted-foreground">Total Intervals:</span>
                <span className="font-medium">{winrateChartData.length}</span>
              </div>
              <div className="flex items-center justify-between p-2 bg-gray-50 rounded">
                <span className="text-muted-foreground">Blocks per Interval:</span>
                <span className="font-medium">100</span>
              </div>
              <div className="flex items-center justify-between p-2 bg-gray-50 rounded">
                <span className="text-muted-foreground">Total Blocks Analyzed:</span>
                <span className="font-medium">
                  {winrateChartData.reduce((sum, interval) => sum + interval.totalBlocks, 0)}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Performance Charts - Grid Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Relay Performance Bar Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5" />
              Relay Performance
            </CardTitle>
            <CardDescription>
              How often each relay beats Bloxroute (respects current filters)
            </CardDescription>
          </CardHeader>
          <CardContent>
            {relayPerformanceLoading ? (
              <div className="flex items-center justify-center p-8">
                <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
                <p className="ml-2 text-muted-foreground">Loading...</p>
              </div>
            ) : relayPerformanceData?.relays && relayPerformanceData.relays.length > 0 ? (
              <div className="h-[400px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart
                    data={relayPerformanceData.relays}
                    margin={{ top: 5, right: 60, left: 20, bottom: 80 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
                    <XAxis
                      dataKey="relay_name"
                      tick={{ fontSize: 11 }}
                      angle={-45}
                      textAnchor="end"
                      height={100}
                    />
                    <YAxis
                      yAxisId="left"
                      tick={{ fontSize: 12 }}
                      label={{ value: 'Win Rate (%)', angle: -90, position: 'insideLeft' }}
                      domain={[0, 100]}
                    />
                    <YAxis
                      yAxisId="right"
                      orientation="right"
                      tick={{ fontSize: 12 }}
                      label={{ value: 'Total Blocks', angle: 90, position: 'insideRight' }}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'rgba(255, 255, 255, 0.95)',
                        border: '1px solid #ccc',
                        borderRadius: '4px'
                      }}
                      formatter={(value: number, name: string) => {
                        if (name === 'Win Rate %') {
                          return [`${value.toFixed(1)}%`, 'Win Rate'];
                        }
                        return [value, 'Total Blocks'];
                      }}
                      labelFormatter={(label) => `${label}`}
                    />
                    <Legend />
                    <Bar yAxisId="left" dataKey="relay_win_rate" name="Win Rate %" fill="#10b981" />
                    <Bar yAxisId="right" dataKey="total_blocks" name="Total Blocks" fill="#3b82f6" opacity={0.7} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="flex items-center justify-center p-8">
                <p className="text-muted-foreground">No relay performance data available</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Location Performance Bar Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MapPin className="h-5 w-5" />
              Location Performance
            </CardTitle>
            <CardDescription>
              Relay win rate by Bloxroute origin (respects current filters)
            </CardDescription>
          </CardHeader>
          <CardContent>
            {locationPerformanceLoading ? (
              <div className="flex items-center justify-center p-8">
                <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
                <p className="ml-2 text-muted-foreground">Loading...</p>
              </div>
            ) : locationPerformanceData?.origins && locationPerformanceData.origins.length > 0 ? (
              <div className="h-[400px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={locationPerformanceData.origins}
                    margin={{ top: 5, right: 30, left: 20, bottom: 80 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
                    <XAxis
                      dataKey="origin"
                      tick={{ fontSize: 11 }}
                      angle={-45}
                      textAnchor="end"
                      height={100}
                    />
                    <YAxis
                      tick={{ fontSize: 12 }}
                      label={{ value: 'Relay Win Rate (%)', angle: -90, position: 'insideLeft' }}
                      domain={[0, 100]}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'rgba(255, 255, 255, 0.95)',
                        border: '1px solid #ccc',
                        borderRadius: '4px'
                      }}
                      formatter={(value: number) => [`${value.toFixed(1)}%`, 'Relay Win Rate']}
                      labelFormatter={(label) => `${label}`}
                    />
                    <Legend />
                    <Bar dataKey="relay_win_percentage" name="Relay Win Rate" fill="#10b981" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="flex items-center justify-center p-8">
                <p className="text-muted-foreground">No location performance data available</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

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
            {/* Filter Mode Selector */}
            <div className="flex gap-2 p-1 bg-gray-100 rounded-lg w-fit">
              <button
                onClick={() => setFilterMode('lastBlocks')}
                className={cn(
                  'px-3 py-1 rounded-md text-sm font-medium transition-colors',
                  filterMode === 'lastBlocks'
                    ? 'bg-white shadow-sm'
                    : 'hover:bg-gray-50'
                )}
              >
                <BarChart3 className="h-4 w-4 inline mr-1" />
                Last Blocks
              </button>
              <button
                onClick={() => setFilterMode('range')}
                className={cn(
                  'px-3 py-1 rounded-md text-sm font-medium transition-colors',
                  filterMode === 'range'
                    ? 'bg-white shadow-sm'
                    : 'hover:bg-gray-50'
                )}
              >
                <Hash className="h-4 w-4 inline mr-1" />
                Block Range
              </button>
              <button
                onClick={() => setFilterMode('date')}
                className={cn(
                  'px-3 py-1 rounded-md text-sm font-medium transition-colors',
                  filterMode === 'date'
                    ? 'bg-white shadow-sm'
                    : 'hover:bg-gray-50'
                )}
              >
                <Calendar className="h-4 w-4 inline mr-1" />
                Date Range
              </button>
            </div>

            {/* Dynamic Filter Controls */}
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

              {/* Filter Mode Specific Controls */}
              {filterMode === 'lastBlocks' && (
                <Select value={lastBlocksFilter} onValueChange={setLastBlocksFilter}>
                  <SelectTrigger className="w-[180px]">
                    <BarChart3 className="h-4 w-4 mr-2" />
                    <SelectValue placeholder="All blocks" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All blocks</SelectItem>
                    <SelectItem value="100">Last 100 blocks</SelectItem>
                    <SelectItem value="500">Last 500 blocks</SelectItem>
                    <SelectItem value="1000">Last 1000 blocks</SelectItem>
                    <SelectItem value="5000">Last 5000 blocks</SelectItem>
                    <SelectItem value="10000">Last 10000 blocks</SelectItem>
                    <SelectItem value="25000">Last 25000 blocks</SelectItem>
                    <SelectItem value="50000">Last 50000 blocks</SelectItem>
                  </SelectContent>
                </Select>
              )}

              {filterMode === 'range' && (
                <>
                  <Input
                    type="number"
                    placeholder="Start block"
                    value={blockRangeStart}
                    onChange={(e) => setBlockRangeStart(e.target.value)}
                    className="w-[140px]"
                  />
                  <Input
                    type="number"
                    placeholder="End block"
                    value={blockRangeEnd}
                    onChange={(e) => setBlockRangeEnd(e.target.value)}
                    className="w-[140px]"
                  />
                </>
              )}

              {filterMode === 'date' && (
                <>
                  <Input
                    type="date"
                    placeholder="From date"
                    value={dateFrom}
                    onChange={(e) => setDateFrom(e.target.value)}
                    className="w-[160px]"
                  />
                  <Input
                    type="date"
                    placeholder="To date"
                    value={dateTo}
                    onChange={(e) => setDateTo(e.target.value)}
                    className="w-[160px]"
                  />
                </>
              )}

              {/* Location Filter */}
              <Select value={locationFilter} onValueChange={setLocationFilter}>
                <SelectTrigger className="w-[200px]">
                  <MapPin className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="All locations" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All locations</SelectItem>
                  {availableLocations?.map((location: string) => (
                    <SelectItem key={location} value={location}>
                      {location}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Exclude Locations Multi-Select */}
              <div className="w-[200px]">
                <MultiSelectDropdown
                  value={excludeLocations}
                  onChange={setExcludeLocations}
                  options={availableLocations || []}
                  placeholder="Exclude locations"
                  icon={MapPin}
                />
              </div>

              {/* Exclude Relays Multi-Select */}
              <div className="w-[200px]">
                <MultiSelectDropdown
                  value={excludeRelays}
                  onChange={setExcludeRelays}
                  options={relayNames || []}
                  placeholder="Exclude relays"
                  icon={Zap}
                />
              </div>
            </div>

            {/* Second row of filters */}
            <div className="flex flex-wrap gap-3">
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

              {/* Items per page */}
              <Select value={limit.toString()} onValueChange={(value) => setLimit(parseInt(value))}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="Items per page" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="25">25 per page</SelectItem>
                  <SelectItem value="50">50 per page</SelectItem>
                  <SelectItem value="100">100 per page</SelectItem>
                  <SelectItem value="200">200 per page</SelectItem>
                  <SelectItem value="500">500 per page</SelectItem>
                  <SelectItem value="1000">1000 per page</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Filter className="h-4 w-4" />
              <span>
                Showing {comparisons.length} of {rawComparisons.length} blocks
                {excludeLocations.length > 0 && ` (${excludeLocations.length} locations excluded)`}
                {excludeRelays.length > 0 && ` (${excludeRelays.length} relays excluded)`}
              </span>
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
                    <TableHead className="w-10"></TableHead>
                    <TableHead className="w-28">Block #</TableHead>
                    <TableHead>Our Relay</TableHead>
                    <TableHead>Bloxroute</TableHead>
                    <TableHead className="hidden lg:table-cell">Pandaops First</TableHead>
                    <TableHead className="text-right">Time Diff</TableHead>
                    <TableHead className="text-center">Result</TableHead>
                    <TableHead className="text-center w-20 hidden md:table-cell">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {comparisons.map((comparison: any) => (
                    <React.Fragment key={comparison.block_number}>
                      <TableRow className="cursor-pointer hover:bg-gray-50" onClick={() => toggleRowExpansion(comparison.block_number)}>
                        <TableCell className="w-10">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0"
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleRowExpansion(comparison.block_number);
                            }}
                          >
                            {expandedRows.has(comparison.block_number) ? (
                              <ChevronDown className="h-4 w-4" />
                            ) : (
                              <ChevronRight className="h-4 w-4" />
                            )}
                          </Button>
                        </TableCell>
                        <TableCell>
                          <Link
                            href={`/slots?block=${comparison.block_number}`}
                            className="font-mono font-semibold text-blue-600 hover:underline block"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <span className="block md:hidden">
                              #
                              {comparison.block_number.toString().length > 3
                                ? comparison.block_number.toString().slice(0, -3)
                                : comparison.block_number}
                            </span>
                            <span className="hidden md:block">
                              #{comparison.block_number}
                            </span>
                          </Link>
                        </TableCell>
                        {/* Our Relay - consolidated name + time */}
                        <TableCell>
                          <div className="space-y-0.5">
                            <div className="font-medium text-green-700">{comparison.first_relay_name}</div>
                            <div className="text-xs font-mono text-slate-500">
                              {formatUTCTimestamp(comparison.first_relay_timestamp)}
                            </div>
                          </div>
                        </TableCell>
                        {/* Bloxroute - consolidated origin + time */}
                        <TableCell>
                          <div className="space-y-0.5">
                            <div className="font-medium text-orange-700">{comparison.bloxroute_origin}</div>
                            <div className="text-xs font-mono text-slate-500">
                              {formatUTCTimestamp(comparison.bloxroute_timestamp)}
                            </div>
                          </div>
                        </TableCell>
                        {/* Pandaops First - time + place */}
                        <TableCell className="hidden lg:table-cell">
                          {propagationData[comparison.block_number] ? (
                            <div className="space-y-0.5">
                              <div className="text-xs font-mono text-purple-700">
                                {(() => {
                                  const pd = propagationData[comparison.block_number];
                                  if (!pd.statistics?.minTime && pd.statistics?.minTime !== 0) return '-';
                                  const slotStartMs = pd.slotStartDateTime * 1000;
                                  const seenMs = slotStartMs + pd.statistics.minTime;
                                  const d = new Date(seenMs);
                                  return `${d.getUTCHours()}:${d.getUTCMinutes().toString().padStart(2, '0')}:${d.getUTCSeconds().toString().padStart(2, '0')}.${d.getUTCMilliseconds().toString().padStart(3, '0')}`;
                                })()}
                              </div>
                              <div className="text-xs text-slate-500">
                                {(() => {
                                  const pd = propagationData[comparison.block_number];
                                  const firstNode = pd.nodes?.[0];
                                  if (!firstNode) return '-';
                                  if (firstNode.city && firstNode.countryCode) {
                                    return `${firstNode.city}, ${firstNode.countryCode}`;
                                  }
                                  return firstNode.country || '-';
                                })()}
                              </div>
                            </div>
                          ) : (
                            <div className="text-xs text-slate-400">Loading...</div>
                          )}
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
                            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                              🏆 Won
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
                              ⚡ Lost
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="text-center hidden md:table-cell">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              refreshBlockMutation.mutate(comparison.block_number);
                            }}
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

                      {/* Expanded Row - Propagation Details */}
                      {expandedRows.has(comparison.block_number) && (
                        <TableRow className="bg-slate-50">
                          <TableCell colSpan={8} className="p-0">
                            <div className="p-4 space-y-4">
                              {!propagationData[comparison.block_number] ? (
                                <div className="flex items-center justify-center py-8">
                                  <RefreshCw className="h-5 w-5 animate-spin mr-2" />
                                  <span className="text-muted-foreground">Loading propagation data from EthPandaOps...</span>
                                </div>
                              ) : (
                                <>
                                  {/* Block Info Header */}
                                  {propagationData[comparison.block_number].blockInfo && (
                                    <div className="bg-gradient-to-r from-purple-50 to-blue-50 border border-purple-200 rounded-lg p-3 mb-3">
                                      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3 text-sm">
                                        <div>
                                          <span className="text-muted-foreground block text-xs">Builder</span>
                                          <span className="font-semibold text-purple-700">
                                            {propagationData[comparison.block_number].blockInfo.builder || 'Unknown'}
                                          </span>
                                        </div>
                                        <div>
                                          <span className="text-muted-foreground block text-xs">Transactions</span>
                                          <span className="font-semibold">{propagationData[comparison.block_number].blockInfo.txCount}</span>
                                        </div>
                                        <div>
                                          <span className="text-muted-foreground block text-xs">Gas Used</span>
                                          <span className="font-mono text-sm">
                                            {((propagationData[comparison.block_number].blockInfo.gasUsed / propagationData[comparison.block_number].blockInfo.gasLimit) * 100).toFixed(1)}%
                                          </span>
                                        </div>
                                        <div>
                                          <span className="text-muted-foreground block text-xs">Exec Block</span>
                                          <span className="font-mono text-sm">#{propagationData[comparison.block_number].blockInfo.execBlockNumber}</span>
                                        </div>
                                        <div>
                                          <span className="text-muted-foreground block text-xs">Proposer</span>
                                          {propagationData[comparison.block_number].proposerEntity?.entityName ? (
                                            <div>
                                              <span className="font-semibold text-indigo-700">
                                                {propagationData[comparison.block_number].proposerEntity.entityName}
                                              </span>
                                              <span className="font-mono text-xs text-muted-foreground ml-1">
                                                (#{propagationData[comparison.block_number].blockInfo.proposer})
                                              </span>
                                            </div>
                                          ) : (
                                            <span className="font-mono text-sm">#{propagationData[comparison.block_number].blockInfo.proposer}</span>
                                          )}
                                        </div>
                                        <div className="hidden lg:block">
                                          <span className="text-muted-foreground block text-xs">Fee Recipient</span>
                                          <span className="font-mono text-xs truncate block" title={propagationData[comparison.block_number].blockInfo.feeRecipient}>
                                            {propagationData[comparison.block_number].blockInfo.feeRecipient?.slice(0, 10)}...
                                          </span>
                                        </div>
                                      </div>
                                    </div>
                                  )}

                                  {/* Timing Reference */}
                                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-3">
                                    <div className="flex flex-wrap items-center gap-4 text-sm">
                                      <div>
                                        <span className="text-muted-foreground">Slot Start: </span>
                                        <span className="font-mono font-bold">
                                          {(() => {
                                            const slotStartMs = propagationData[comparison.block_number].slotStartDateTime * 1000;
                                            const d = new Date(slotStartMs);
                                            return `${d.getUTCHours()}:${d.getUTCMinutes().toString().padStart(2, '0')}:${d.getUTCSeconds().toString().padStart(2, '0')}.000`;
                                          })()}
                                        </span>
                                      </div>
                                      <div>
                                        <span className="text-muted-foreground">Relay: </span>
                                        <span className="font-mono font-bold text-green-700">{formatUTCTimestamp(comparison.first_relay_timestamp)}</span>
                                      </div>
                                      <div>
                                        <span className="text-muted-foreground">Bloxroute: </span>
                                        <span className="font-mono font-bold text-orange-700">{formatUTCTimestamp(comparison.bloxroute_timestamp)}</span>
                                      </div>
                                      <div>
                                        <span className="text-muted-foreground">Diff: </span>
                                        <span className={cn(
                                          "font-mono font-bold",
                                          comparison.time_difference_ms < 0 ? "text-green-600" : "text-red-600"
                                        )}>
                                          {comparison.time_difference_ms < 0 ? '-' : '+'}
                                          {Math.abs(comparison.time_difference_ms)}ms
                                        </span>
                                      </div>
                                    </div>
                                  </div>

                                  {/* Propagation Statistics */}
                                  <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                                    <div className="bg-white rounded-lg p-3 border">
                                      <div className="text-xs text-muted-foreground">Total Nodes</div>
                                      <div className="text-lg font-bold">{propagationData[comparison.block_number].totalNodes}</div>
                                    </div>
                                    <div className="bg-white rounded-lg p-3 border">
                                      <div className="text-xs text-muted-foreground">Fastest (from slot)</div>
                                      <div className="text-lg font-bold text-green-600">+{propagationData[comparison.block_number].statistics?.minTime}ms</div>
                                      <div className="text-xs font-mono text-muted-foreground">
                                        {(() => {
                                          const slotStartMs = propagationData[comparison.block_number].slotStartDateTime * 1000;
                                          const seenMs = slotStartMs + propagationData[comparison.block_number].statistics?.minTime;
                                          const d = new Date(seenMs);
                                          return `${d.getUTCHours()}:${d.getUTCMinutes().toString().padStart(2, '0')}:${d.getUTCSeconds().toString().padStart(2, '0')}.${d.getUTCMilliseconds().toString().padStart(3, '0')}`;
                                        })()}
                                      </div>
                                    </div>
                                    <div className="bg-white rounded-lg p-3 border">
                                      <div className="text-xs text-muted-foreground">Slowest (from slot)</div>
                                      <div className="text-lg font-bold text-red-600">+{propagationData[comparison.block_number].statistics?.maxTime}ms</div>
                                      <div className="text-xs font-mono text-muted-foreground">
                                        {(() => {
                                          const slotStartMs = propagationData[comparison.block_number].slotStartDateTime * 1000;
                                          const seenMs = slotStartMs + propagationData[comparison.block_number].statistics?.maxTime;
                                          const d = new Date(seenMs);
                                          return `${d.getUTCHours()}:${d.getUTCMinutes().toString().padStart(2, '0')}:${d.getUTCSeconds().toString().padStart(2, '0')}.${d.getUTCMilliseconds().toString().padStart(3, '0')}`;
                                        })()}
                                      </div>
                                    </div>
                                    <div className="bg-white rounded-lg p-3 border">
                                      <div className="text-xs text-muted-foreground">Average (from slot)</div>
                                      <div className="text-lg font-bold text-blue-600">+{propagationData[comparison.block_number].statistics?.avgTime}ms</div>
                                    </div>
                                    <div className="bg-white rounded-lg p-3 border">
                                      <div className="text-xs text-muted-foreground">Median (from slot)</div>
                                      <div className="text-lg font-bold text-purple-600">+{propagationData[comparison.block_number].statistics?.medianTime}ms</div>
                                    </div>
                                  </div>

                                  {/* By Country */}
                                  {propagationData[comparison.block_number].byCountry?.length > 0 && (
                                    <div className="space-y-2">
                                      <h4 className="text-sm font-semibold flex items-center gap-2">
                                        <Globe className="h-4 w-4" />
                                        Propagation by Country (Fastest First)
                                      </h4>
                                      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2">
                                        {propagationData[comparison.block_number].byCountry.slice(0, 12).map((country: any, idx: number) => (
                                          <div key={country.country} className={cn(
                                            "bg-white rounded-lg p-2 border text-sm",
                                            idx === 0 && "ring-2 ring-green-500"
                                          )}>
                                            <div className="font-medium truncate">{country.country}</div>
                                            <div className="flex justify-between text-xs text-muted-foreground">
                                              <span>{country.count} nodes</span>
                                              <span className="font-mono text-green-700">{country.minTime}ms</span>
                                            </div>
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  )}

                                  {/* Top Nodes Table */}
                                  {propagationData[comparison.block_number].nodes?.length > 0 && (
                                    <div className="space-y-2">
                                      <h4 className="text-sm font-semibold flex items-center gap-2">
                                        <Clock className="h-4 w-4" />
                                        Fastest Nodes (sorted by propagation time)
                                      </h4>
                                      <div className="overflow-x-auto">
                                        <table className="w-full text-sm">
                                          <thead>
                                            <tr className="border-b bg-white">
                                              <th className="text-left p-2 font-medium">#</th>
                                              <th className="text-left p-2 font-medium">Seen At (UTC)</th>
                                              <th className="text-left p-2 font-medium">From Slot</th>
                                              <th className="text-left p-2 font-medium">Location</th>
                                              <th className="text-left p-2 font-medium hidden md:table-cell">Consensus</th>
                                              <th className="text-left p-2 font-medium hidden lg:table-cell">Client</th>
                                              <th className="text-left p-2 font-medium hidden xl:table-cell">Source</th>
                                            </tr>
                                          </thead>
                                          <tbody>
                                            {propagationData[comparison.block_number].nodes.slice(0, 20).map((node: any, idx: number) => {
                                              const slotStartMs = propagationData[comparison.block_number].slotStartDateTime * 1000;
                                              const seenMs = slotStartMs + node.seenSlotStartDiff;
                                              const seenDate = new Date(seenMs);
                                              const seenTime = `${seenDate.getUTCHours()}:${seenDate.getUTCMinutes().toString().padStart(2, '0')}:${seenDate.getUTCSeconds().toString().padStart(2, '0')}.${seenDate.getUTCMilliseconds().toString().padStart(3, '0')}`;

                                              return (
                                                <tr key={node.nodeId} className={cn(
                                                  "border-b",
                                                  idx === 0 && "bg-green-50",
                                                  idx < 3 && "font-medium"
                                                )}>
                                                  <td className="p-2">
                                                    {idx === 0 ? "🥇" : idx === 1 ? "🥈" : idx === 2 ? "🥉" : idx + 1}
                                                  </td>
                                                  <td className="p-2 font-mono">
                                                    <span className={cn(
                                                      idx === 0 && "text-green-600 font-bold"
                                                    )}>
                                                      {seenTime}
                                                    </span>
                                                  </td>
                                                  <td className="p-2 font-mono text-muted-foreground">
                                                    +{node.seenSlotStartDiff}ms
                                                  </td>
                                                  <td className="p-2">
                                                    {node.city && node.country ? (
                                                      <span>{node.city}, {node.countryCode}</span>
                                                    ) : node.country ? (
                                                      <span>{node.country}</span>
                                                    ) : (
                                                      <span className="text-muted-foreground">Unknown</span>
                                                    )}
                                                  </td>
                                                  <td className="p-2 hidden md:table-cell">
                                                    <span className="px-2 py-0.5 bg-blue-100 text-blue-800 rounded text-xs">
                                                      {node.consensusImpl}
                                                    </span>
                                                  </td>
                                                  <td className="p-2 hidden lg:table-cell text-xs text-muted-foreground truncate max-w-[200px]">
                                                    {node.clientName}
                                                  </td>
                                                  <td className="p-2 hidden xl:table-cell text-xs">
                                                    {node.source?.replace('beacon_api_eth_v1_events_', '')}
                                                  </td>
                                                </tr>
                                              );
                                            })}
                                          </tbody>
                                        </table>
                                      </div>
                                    </div>
                                  )}

                                  {propagationData[comparison.block_number].totalNodes === 0 && (
                                    <div className="text-center py-4 text-muted-foreground">
                                      No propagation data available for this slot
                                    </div>
                                  )}
                                </>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </React.Fragment>
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

          {/* Origin Filters */}
          <div className="flex gap-2 pb-4 border-b">
            <div className="flex gap-2 p-1 bg-gray-100 rounded-lg">
              <button
                onClick={() => setOriginFilterMode('all')}
                className={cn(
                  'px-3 py-1 rounded-md text-sm font-medium transition-colors',
                  originFilterMode === 'all'
                    ? 'bg-white shadow-sm'
                    : 'hover:bg-gray-50'
                )}
              >
                All Blocks
              </button>
              <button
                onClick={() => setOriginFilterMode('lastBlocks')}
                className={cn(
                  'px-3 py-1 rounded-md text-sm font-medium transition-colors',
                  originFilterMode === 'lastBlocks'
                    ? 'bg-white shadow-sm'
                    : 'hover:bg-gray-50'
                )}
              >
                Last X Blocks
              </button>
              <button
                onClick={() => setOriginFilterMode('range')}
                className={cn(
                  'px-3 py-1 rounded-md text-sm font-medium transition-colors',
                  originFilterMode === 'range'
                    ? 'bg-white shadow-sm'
                    : 'hover:bg-gray-50'
                )}
              >
                Block Range
              </button>
            </div>

            {originFilterMode === 'lastBlocks' && (
              <Input
                type="number"
                placeholder="Number of blocks"
                value={originLastBlocks}
                onChange={(e) => setOriginLastBlocks(e.target.value)}
                className="w-[150px]"
              />
            )}

            {originFilterMode === 'range' && (
              <>
                <Input
                  type="number"
                  placeholder="Start block"
                  value={originBlockStart}
                  onChange={(e) => setOriginBlockStart(e.target.value)}
                  className="w-[140px]"
                />
                <Input
                  type="number"
                  placeholder="End block"
                  value={originBlockEnd}
                  onChange={(e) => setOriginBlockEnd(e.target.value)}
                  className="w-[140px]"
                />
              </>
            )}

            <Button
              size="sm"
              variant="outline"
              onClick={() => refetchOrigins()}
              disabled={originLoading}
            >
              <RefreshCw className={cn('h-4 w-4 mr-2', originLoading && 'animate-spin')} />
              Apply Filters
            </Button>
          </div>

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