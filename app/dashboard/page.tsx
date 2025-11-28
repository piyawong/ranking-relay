'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import TradingViewChart from '@/components/TradingViewChart';
import {
  RefreshCw,
  DollarSign,
  Wallet,
  Activity,
  Trash2,
  Coins,
  Clock,
  TrendingUp,
  TrendingDown,
  Radio,
  Wrench,
  ChevronDown,
  ChevronUp,
  AlertTriangle
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useWebSocket } from '@/lib/hooks/useWebSocket';
import {
  calculateProfitAnalytics,
  formatProfitLoss,
  formatPercent,
  formatDuration,
  getProfitLossColor
} from '@/lib/utils/profit-analytics';

// Fetch balance analytics
async function fetchBalanceAnalytics() {
  // Fetch all available data (limit=0 means no limit)
  const response = await fetch('/api/balance/analytics?limit=0');
  if (!response.ok) throw new Error('Failed to fetch analytics');
  const data = await response.json();
  return data.data;
}

// Fetch RLB price
async function fetchRLBPrice() {
  const response = await fetch('/api/balance/price');
  if (!response.ok) throw new Error('Failed to fetch RLB price');
  const data = await response.json();
  return data.data;
}

// Flush all balance data
async function flushAllData() {
  const response = await fetch('/api/balance/snapshot?confirm=true', {
    method: 'DELETE'
  });
  if (!response.ok) {
    const data = await response.json();
    throw new Error(data.error || 'Failed to flush data');
  }
  return response.json();
}

// Fetch balance snapshots with high diff
async function fetchHighDiffSnapshots() {
  const response = await fetch('/api/balance/high-diff');
  if (!response.ok) throw new Error('Failed to fetch high diff snapshots');
  const data = await response.json();
  return data.data;
}

// Fetch all spikes for manual review
async function fetchAllSpikes() {
  const response = await fetch('/api/balance/spikes');
  if (!response.ok) throw new Error('Failed to fetch spikes');
  const data = await response.json();
  return data.data;
}

// Format number helper
function formatNumber(value: number, decimals: number = 2): string {
  return value.toFixed(decimals);
}

interface HistoryPoint {
  timestamp: string;
  total_usd: number;
  total_usd_usdt: number;
  total_rlb: number;
  rlb_price_usd?: number; // RLB price at the time of snapshot
}

type TimeRange = '1h' | '6h' | '24h' | '7d' | '30d' | 'all';

export default function DashboardPage() {
  const [liveHistory, setLiveHistory] = useState<HistoryPoint[]>([]);
  const [displayHistory, setDisplayHistory] = useState<HistoryPoint[]>([]); // Debounced for charts
  const [isFlushing, setIsFlushing] = useState(false);
  const [isCleaningHighDiff, setIsCleaningHighDiff] = useState(false);
  const [cleanupProgress, setCleanupProgress] = useState({ current: 0, total: 0 });
  const [timeRange, setTimeRange] = useState<TimeRange>('24h');
  const [customDays, setCustomDays] = useState<string>('');
  const [useMockData, setUseMockData] = useState(false);
  const [showSpikes, setShowSpikes] = useState(false);
  const [deletingSpike, setDeletingSpike] = useState<string | null>(null);

  // Debounce live history updates to prevent excessive chart re-renders
  const updateTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // Clear existing timer
    if (updateTimerRef.current) {
      clearTimeout(updateTimerRef.current);
    }

    // Debounce: Update displayHistory only every 2 seconds
    updateTimerRef.current = setTimeout(() => {
      setDisplayHistory(liveHistory);
    }, 2000);

    return () => {
      if (updateTimerRef.current) {
        clearTimeout(updateTimerRef.current);
      }
    };
  }, [liveHistory]);

  // Fetch analytics data
  const { data: analytics, isLoading, refetch } = useQuery({
    queryKey: ['balance-analytics'],
    queryFn: fetchBalanceAnalytics,
    refetchInterval: false, // Disable polling
  });

  // Fetch RLB price
  const { data: priceData } = useQuery({
    queryKey: ['rlb-price'],
    queryFn: fetchRLBPrice,
    refetchInterval: 5 * 60 * 1000, // Refresh price every 5 minutes
  });

  // Fetch all spikes for manual review
  const { data: spikesData, refetch: refetchSpikes } = useQuery({
    queryKey: ['balance-spikes'],
    queryFn: fetchAllSpikes,
    enabled: showSpikes, // Only fetch when expanded
  });

  // Use ref for priceData to avoid recreating callback on price updates
  const priceDataRef = useRef(priceData);
  useEffect(() => {
    priceDataRef.current = priceData;
  }, [priceData]);

  // WebSocket connection for real-time updates
  const handleBalanceSnapshot = useCallback((data: {
    id: string;
    ts: string;
    onchain: { rlb: number; usdt: number };
    onsite: { rlb: number; usd: number };
  }) => {
    console.log('[Dashboard] New balance snapshot:', data);

    // Calculate values from incoming snapshot
    const rlbPrice = priceDataRef.current?.price_usd || 0;
    const totalUSD =
      data.onsite.usd +
      data.onchain.usdt +
      data.onsite.rlb * rlbPrice +
      data.onchain.rlb * rlbPrice;
    const totalUSDUSDT = data.onsite.usd + data.onchain.usdt;
    const totalRLB = data.onsite.rlb + data.onchain.rlb;

    // Add to live history
    const newPoint: HistoryPoint = {
      timestamp: data.ts,
      total_usd: totalUSD,
      total_usd_usdt: totalUSDUSDT,
      total_rlb: totalRLB
    };

    setLiveHistory((prev) => {
      const updated = [...prev, newPoint];
      // Keep only last 200 points for live updates
      return updated.slice(-200);
    });

    // Disabled automatic refetch - relying on WebSocket updates only
    // refetch();
  }, []);

  const { isConnected } = useWebSocket({
    onBalanceSnapshot: handleBalanceSnapshot,
    autoConnect: true
  });

  const currentBalance = analytics?.currentBalance || {
    total_usd: 0,
    total_usd_usdt: 0,
    total_rlb: 0,
    onsite_rlb: 0,
    onsite_usd: 0,
    onchain_rlb: 0,
    onchain_usdt: 0,
    onsite_rlb_value_usd: 0,
    onchain_rlb_value_usd: 0,
    onsite_total_usd: 0,
    onchain_total_usd: 0,
    rlb_price_usd: 0,
    rlb_price_last_updated: new Date().toISOString()
  };

  const history = analytics?.history || [];

  // Combine API history with debounced live updates (prevents chart re-render on every WS message)
  const combinedHistory = useMemo(() => [...history, ...displayHistory], [history, displayHistory]);

  // Filter data based on time range
  const filteredHistory = useMemo(() => {
    // If custom days is set and valid, use that instead
    const parsedCustomDays = parseInt(customDays, 10);
    if (customDays && !isNaN(parsedCustomDays) && parsedCustomDays > 0) {
      const now = new Date();
      const cutoffTime = new Date();
      cutoffTime.setDate(now.getDate() - parsedCustomDays);
      return combinedHistory.filter((item) => new Date(item.timestamp) >= cutoffTime);
    }

    if (timeRange === 'all') return combinedHistory;

    const now = new Date();
    const cutoffTime = new Date();

    switch (timeRange) {
      case '1h':
        cutoffTime.setHours(now.getHours() - 1);
        break;
      case '6h':
        cutoffTime.setHours(now.getHours() - 6);
        break;
      case '24h':
        cutoffTime.setHours(now.getHours() - 24);
        break;
      case '7d':
        cutoffTime.setDate(now.getDate() - 7);
        break;
      case '30d':
        cutoffTime.setDate(now.getDate() - 30);
        break;
      default:
        return combinedHistory;
    }

    return combinedHistory.filter((item) => new Date(item.timestamp) >= cutoffTime);
  }, [combinedHistory, timeRange, customDays]);

  // Downsample data to reduce chart points
  const downsampleData = useCallback((data: HistoryPoint[], range: TimeRange | string, customDaysValue?: string): HistoryPoint[] => {
    if (data.length === 0) return data;

    // Determine interval in milliseconds based on range
    let intervalMs = 60000; // Default: 1 minute

    const parsedCustomDays = customDaysValue ? parseInt(customDaysValue, 10) : 0;

    if (parsedCustomDays > 0) {
      // Custom days range
      if (parsedCustomDays <= 1) {
        intervalMs = 60000; // 1 minute for 1 day or less
      } else if (parsedCustomDays <= 7) {
        intervalMs = 300000; // 5 minutes for up to 7 days
      } else if (parsedCustomDays <= 30) {
        intervalMs = 900000; // 15 minutes for up to 30 days
      } else {
        intervalMs = 3600000; // 1 hour for more than 30 days
      }
    } else {
      // Preset ranges
      switch (range) {
        case '1h':
          intervalMs = 30000; // 30 seconds
          break;
        case '6h':
          intervalMs = 60000; // 1 minute
          break;
        case '24h':
          intervalMs = 120000; // 2 minutes
        break;
        case '7d':
          intervalMs = 300000; // 5 minutes
          break;
        case '30d':
          intervalMs = 900000; // 15 minutes
          break;
        case 'all':
          // For 'all', determine based on data span
          const firstTime = new Date(data[0].timestamp).getTime();
          const lastTime = new Date(data[data.length - 1].timestamp).getTime();
          const spanDays = (lastTime - firstTime) / (1000 * 60 * 60 * 24);

          if (spanDays <= 1) {
            intervalMs = 60000; // 1 minute
          } else if (spanDays <= 7) {
            intervalMs = 300000; // 5 minutes
          } else if (spanDays <= 30) {
            intervalMs = 900000; // 15 minutes
          } else {
            intervalMs = 3600000; // 1 hour
          }
          break;
      }
    }

    // Group data into buckets and take the last point from each bucket
    const buckets = new Map<number, HistoryPoint>();

    data.forEach((point) => {
      const timestamp = new Date(point.timestamp).getTime();
      const bucketKey = Math.floor(timestamp / intervalMs);
      // Always take the latest point in each bucket (overwrites previous)
      buckets.set(bucketKey, point);
    });

    // Convert back to array and sort by timestamp
    return Array.from(buckets.values()).sort(
      (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );
  }, []);

  // Downsample the filtered data
  const downsampledHistory = useMemo(() =>
    downsampleData(filteredHistory, timeRange, customDays),
    [filteredHistory, timeRange, customDays, downsampleData]
  );

  // Calculate profit analytics for the current time range (use full data for accuracy)
  const profitAnalytics = useMemo(() => calculateProfitAnalytics(filteredHistory, 'total_usd'), [filteredHistory]);
  const profitAnalyticsStablecoins = useMemo(() => calculateProfitAnalytics(filteredHistory, 'total_usd_usdt'), [filteredHistory]);

  // Generate mock data for testing
  const generateMockData = useCallback((baseValue: number, count: number = 100) => {
    const now = Math.floor(Date.now() / 1000);
    const interval = 300; // 5 minutes
    return Array.from({ length: count }, (_, i) => ({
      time: now - (count - i) * interval,
      value: baseValue + Math.sin(i / 10) * 50 + Math.random() * 20
    }));
  }, []);

  // Format data for TradingView charts (unix timestamp + value)
  // Use downsampled data for better performance
  const chartDataUsd = useMemo(() => {
    if (useMockData) return generateMockData(16500, 200);

    return downsampledHistory
      .filter((item) => item && item.total_usd != null && !isNaN(item.total_usd) && isFinite(item.total_usd))
      .map((item) => ({
        time: Math.floor(new Date(item.timestamp).getTime() / 1000),
        value: item.total_usd
      }));
  }, [downsampledHistory, useMockData, generateMockData]);

  const chartDataUsdUsdt = useMemo(() => {
    if (useMockData) return generateMockData(16200, 200);

    return downsampledHistory
      .filter((item) => item && item.total_usd_usdt != null && !isNaN(item.total_usd_usdt) && isFinite(item.total_usd_usdt))
      .map((item) => ({
        time: Math.floor(new Date(item.timestamp).getTime() / 1000),
        value: item.total_usd_usdt
      }));
  }, [downsampledHistory, useMockData, generateMockData]);

  const chartDataRlb = useMemo(() => {
    if (useMockData) return generateMockData(221500, 200);

    return downsampledHistory
      .filter((item) => item && item.total_rlb != null && !isNaN(item.total_rlb) && isFinite(item.total_rlb))
      .map((item) => ({
        time: Math.floor(new Date(item.timestamp).getTime() / 1000),
        value: item.total_rlb
      }));
  }, [downsampledHistory, useMockData, generateMockData]);

  // RLB Price data for secondary chart series
  const chartDataRlbPrice = useMemo(() => {
    if (useMockData) return generateMockData(0.075, 200);

    return downsampledHistory
      .filter((item) => item && item.rlb_price_usd != null && !isNaN(item.rlb_price_usd) && isFinite(item.rlb_price_usd) && item.rlb_price_usd > 0)
      .map((item) => ({
        time: Math.floor(new Date(item.timestamp).getTime() / 1000),
        value: item.rlb_price_usd!
      }));
  }, [downsampledHistory, useMockData, generateMockData]);

  // Debug logging
  useEffect(() => {
    if (!useMockData) {
      console.log('Chart data lengths:', {
        usd: chartDataUsd.length,
        usdUsdt: chartDataUsdUsdt.length,
        rlb: chartDataRlb.length,
        filteredHistory: filteredHistory.length,
        downsampledHistory: downsampledHistory.length,
        reductionRatio: filteredHistory.length > 0
          ? `${((1 - downsampledHistory.length / filteredHistory.length) * 100).toFixed(1)}% reduced`
          : 'N/A'
      });

      // Check for null values
      const nullUsd = chartDataUsd.filter(d => d.value == null || isNaN(d.value));
      const nullUsdUsdt = chartDataUsdUsdt.filter(d => d.value == null || isNaN(d.value));
      const nullRlb = chartDataRlb.filter(d => d.value == null || isNaN(d.value));

      if (nullUsd.length > 0 || nullUsdUsdt.length > 0 || nullRlb.length > 0) {
        console.error('Found null values:', { nullUsd, nullUsdUsdt, nullRlb });
      }

      // Sample first few data points
      console.log('Sample USD data:', chartDataUsd.slice(0, 3));
      console.log('Sample USDT data:', chartDataUsdUsdt.slice(0, 3));
      console.log('Sample RLB data:', chartDataRlb.slice(0, 3));
    }
  }, [useMockData, chartDataUsd, chartDataUsdUsdt, chartDataRlb, filteredHistory.length, downsampledHistory.length]);

  // Handle flush all data
  const handleFlushData = async () => {
    const confirmed = window.confirm(
      '⚠️ WARNING: This will delete ALL balance snapshot data!\n\n' +
      'This action cannot be undone. Are you sure you want to continue?'
    );

    if (!confirmed) return;

    setIsFlushing(true);
    try {
      await flushAllData();
      // Clear live history
      setLiveHistory([]);
      setDisplayHistory([]);
      // Refetch data after flush
      refetch();
      alert('All balance data has been deleted successfully.');
    } catch (error) {
      alert(`Error: ${error instanceof Error ? error.message : 'Failed to flush data'}`);
    } finally {
      setIsFlushing(false);
    }
  };

  // Handle remove high diff snapshots
  const handleRemoveHighDiff = async () => {
    try {
      setIsCleaningHighDiff(true);
      let totalDeleted = 0;
      let iteration = 0;
      const maxIterations = 100; // Safety limit (increased for cascading anomalies)

      while (iteration < maxIterations) {
        // Fetch current high diff snapshots
        const highDiffData = await fetchHighDiffSnapshots();
        const highDiffSnapshots = highDiffData.snapshotIds || [];
        const details = highDiffData.details || [];

        if (highDiffSnapshots.length === 0) {
          if (totalDeleted === 0) {
            alert('No balance snapshots with high differences found!\n\nThresholds:\n- USDT/USD: ±300\n- RLB: ±999');
          } else {
            alert(`✅ Successfully cleaned ${totalDeleted} anomalous snapshots from the database.`);
          }
          break;
        }

        // Only show confirmation on first iteration
        if (iteration === 0) {
          // Show details to user
          const detailsText = details.slice(0, 5).map((d: any) =>
            `• ${new Date(d.timestamp).toLocaleString()}: ${d.reason}`
          ).join('\n');

          const moreText = details.length > 5 ? `\n... and ${details.length - 5} more` : '';

          const confirmed = window.confirm(
            `Found ${highDiffSnapshots.length} snapshots with abnormal changes:\n\n${detailsText}${moreText}\n\n` +
            '⚠️ PERMANENTLY DELETE these snapshots from the database?\n\n' +
            'This action cannot be undone!\n\n' +
            'Thresholds:\n- USDT/USD: ±300\n- RLB: ±999'
          );

          if (!confirmed) {
            setIsCleaningHighDiff(false);
            return;
          }
        }

        setCleanupProgress({ current: totalDeleted, total: totalDeleted + highDiffSnapshots.length });

        // Batch delete in parallel for efficiency (max 5 at a time)
        const batchSize = 5;
        for (let i = 0; i < highDiffSnapshots.length; i += batchSize) {
          const batch = highDiffSnapshots.slice(i, i + batchSize);
          const deletePromises = batch.map((snapshotId: string) =>
            fetch(`/api/balance/high-diff/delete?snapshotId=${snapshotId}`, {
              method: 'DELETE'
            }).then(res => res.ok).catch(() => false)
          );

          const results = await Promise.all(deletePromises);
          const successCount = results.filter(r => r).length;
          totalDeleted += successCount;
          setCleanupProgress({ current: totalDeleted, total: totalDeleted + (highDiffSnapshots.length - i - batch.length) });
        }

        iteration++;

        // Small delay between iterations to avoid overwhelming the server
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      if (iteration >= maxIterations) {
        alert(`⚠️ Stopped after ${maxIterations} iterations. Deleted ${totalDeleted} snapshots. Some anomalies might remain.`);
      }

      // Clear live history and refetch
      setLiveHistory([]);
      setDisplayHistory([]);
      await refetch();

    } catch (error) {
      console.error('Error removing high diff snapshots:', error);
      alert(`Error: ${error instanceof Error ? error.message : 'Failed to remove high diff snapshots'}`);
    } finally {
      setIsCleaningHighDiff(false);
      setCleanupProgress({ current: 0, total: 0 });
    }
  };

  // Handle delete individual spike
  const handleDeleteSpike = async (spikeId: string) => {
    try {
      setDeletingSpike(spikeId);
      const response = await fetch(`/api/balance/high-diff/delete?snapshotId=${spikeId}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        // Refetch spikes list and analytics
        await Promise.all([refetchSpikes(), refetch()]);
        alert('✓ Spike deleted successfully');
      } else {
        const data = await response.json();
        alert(`Error: ${data.error || 'Failed to delete spike'}`);
      }
    } catch (error) {
      alert(`Error: ${error instanceof Error ? error.message : 'Failed to delete spike'}`);
    } finally {
      setDeletingSpike(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl font-bold">Balance Dashboard</h1>
            <p className="text-muted-foreground">
              Real-time balance tracking across all accounts
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2 mr-2">
              <Radio className={cn('h-4 w-4', isConnected ? 'text-green-500 animate-pulse' : 'text-gray-400')} />
              <span className="text-xs text-muted-foreground">
                {isConnected ? 'Live' : 'Offline'}
              </span>
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
            <Button
              variant="outline"
              size="sm"
              onClick={handleRemoveHighDiff}
              disabled={isCleaningHighDiff || isLoading}
              title="Permanently delete snapshots with large price jumps (USDT/USD: ±300, RLB: ±999)"
            >
              <Wrench className={cn('h-4 w-4 mr-2', isCleaningHighDiff && 'animate-spin')} />
              {isCleaningHighDiff ? `Cleaning (${cleanupProgress.current}/${cleanupProgress.total})` : 'Fix High Diff'}
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

        {/* Time Range Switcher - TradingView Style */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Range:</span>
          </div>
          <div className="flex gap-1">
            {[
              { value: '1h', label: '1H' },
              { value: '6h', label: '6H' },
              { value: '24h', label: '1D' },
              { value: '7d', label: '1W' },
              { value: '30d', label: '1M' },
              { value: 'all', label: 'ALL' },
            ].map((range) => (
              <button
                key={range.value}
                onClick={() => {
                  setTimeRange(range.value as TimeRange);
                  setCustomDays(''); // Clear custom days when selecting preset
                }}
                className={`px-3 py-1.5 text-xs font-medium rounded transition-colors ${
                  timeRange === range.value && !customDays
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted hover:bg-muted/80 text-muted-foreground'
                }`}
              >
                {range.label}
              </button>
            ))}
          </div>

          {/* Custom Days Input */}
          <div className="flex items-center gap-2 ml-2">
            <span className="text-xs text-muted-foreground">or Last</span>
            <Input
              type="number"
              min="1"
              placeholder="Days"
              value={customDays}
              onChange={(e) => setCustomDays(e.target.value)}
              className={cn(
                "w-20 h-8 text-xs",
                customDays && parseInt(customDays) > 0 && "ring-2 ring-primary"
              )}
            />
            <span className="text-xs text-muted-foreground">days</span>
            {customDays && (
              <button
                onClick={() => setCustomDays('')}
                className="text-xs text-muted-foreground hover:text-foreground"
                title="Clear custom range"
              >
                ✕
              </button>
            )}
          </div>

          <span className="text-xs text-muted-foreground">
            ({filteredHistory.length} total → {downsampledHistory.length} displayed)
          </span>
          <div className="ml-auto">
            <button
              onClick={() => setUseMockData(!useMockData)}
              className={`px-3 py-1.5 text-xs font-medium rounded transition-colors ${
                useMockData
                  ? 'bg-yellow-600 text-white'
                  : 'bg-muted hover:bg-muted/80 text-muted-foreground'
              }`}
            >
              {useMockData ? 'MOCK DATA' : 'REAL DATA'}
            </button>
          </div>
        </div>

        {/* Spike Management - Collapsible */}
        <Card className="border-yellow-200 dark:border-yellow-800">
          <CardHeader className="cursor-pointer hover:bg-muted/50" onClick={() => setShowSpikes(!showSpikes)}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-yellow-600" />
                <CardTitle className="text-lg">Spike Management</CardTitle>
                {spikesData && (
                  <span className="text-sm text-muted-foreground">
                    ({spikesData.count} spikes found)
                  </span>
                )}
              </div>
              {showSpikes ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
            </div>
            <CardDescription>
              Review and manually delete balance snapshots with jumps (USDT &gt; 500 or RLB &gt; 5000)
            </CardDescription>
          </CardHeader>
          {showSpikes && (
            <CardContent className="pt-0">
              {!spikesData ? (
                <div className="flex items-center justify-center py-8">
                  <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : spikesData.count === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  ✓ No spikes found! All data looks clean.
                </div>
              ) : (
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {spikesData.spikes.map((spike: any) => (
                    <div
                      key={spike.id}
                      className="flex items-center justify-between p-3 bg-muted/50 rounded-lg hover:bg-muted transition-colors"
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-3">
                          <span className="text-sm font-mono text-muted-foreground">
                            {new Date(spike.timestamp).toLocaleString()}
                          </span>
                          <span className="text-sm font-semibold">{spike.reason}</span>
                        </div>
                        <div className="text-xs text-muted-foreground mt-1">
                          USDT: ${spike.usdUsdt.toFixed(2)} | RLB: {spike.rlb.toFixed(2)}
                        </div>
                      </div>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => handleDeleteSpike(spike.id)}
                        disabled={deletingSpike === spike.id}
                      >
                        {deletingSpike === spike.id ? (
                          <>
                            <RefreshCw className="h-3 w-3 mr-1 animate-spin" />
                            Deleting...
                          </>
                        ) : (
                          <>
                            <Trash2 className="h-3 w-3 mr-1" />
                            Delete
                          </>
                        )}
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          )}
        </Card>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Balance (USD)</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ${formatNumber(currentBalance.total_usd || 0, 2)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              All assets converted to USD
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Stablecoins (USD+USDT)</CardTitle>
            <Coins className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              ${formatNumber(currentBalance.total_usd_usdt || 0, 2)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              On-site USD + On-chain USDT
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total RLB</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              {formatNumber(currentBalance.total_rlb || 0, 2)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              On-site + On-chain RLB tokens
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">RLB Price</CardTitle>
            <Wallet className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ${formatNumber(priceData?.price_usd || currentBalance.rlb_price_usd || 0, 6)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Current market price (CoinGecko)
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Profit Analytics - Total USD */}
      {profitAnalytics && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {profitAnalytics.profitLoss >= 0 ? (
                <TrendingUp className="h-5 w-5 text-green-600" />
              ) : (
                <TrendingDown className="h-5 w-5 text-red-600" />
              )}
              Total Balance P/L (All Assets) - {customDays ? `Last ${customDays} Days` : timeRange.toUpperCase()}
            </CardTitle>
            <CardDescription>
              Performance metrics including RLB value for the selected time period ({formatDuration(profitAnalytics.totalHours)})
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {/* Profit/Loss */}
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Total P/L</p>
                <p className={cn('text-2xl font-bold', getProfitLossColor(profitAnalytics.profitLoss))}>
                  {formatProfitLoss(profitAnalytics.profitLoss)}
                </p>
                <p className={cn('text-sm font-medium', getProfitLossColor(profitAnalytics.profitLoss))}>
                  {formatPercent(profitAnalytics.profitLossPercent)}
                </p>
              </div>

              {/* Profit Per Hour */}
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Profit/Hour</p>
                <p className={cn('text-2xl font-bold', getProfitLossColor(profitAnalytics.profitPerHour))}>
                  {formatProfitLoss(profitAnalytics.profitPerHour)}
                </p>
                <p className="text-xs text-muted-foreground">
                  Per day: {formatProfitLoss(profitAnalytics.profitPerDay)}
                </p>
              </div>

              {/* Start/End Values */}
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Start → End</p>
                <p className="text-lg font-semibold">
                  ${formatNumber(profitAnalytics.startValue, 2)}
                </p>
                <p className="text-lg font-semibold text-primary">
                  ${formatNumber(profitAnalytics.endValue, 2)}
                </p>
              </div>

              {/* Range & Volatility */}
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Range</p>
                <p className="text-sm">
                  <span className="text-green-600 font-semibold">High: ${formatNumber(profitAnalytics.maxValue, 2)}</span>
                </p>
                <p className="text-sm">
                  <span className="text-red-600 font-semibold">Low: ${formatNumber(profitAnalytics.minValue, 2)}</span>
                </p>
                <p className="text-xs text-muted-foreground">
                  Volatility: ±${formatNumber(profitAnalytics.volatility, 2)}
                </p>
              </div>
            </div>

            {/* Additional Metrics */}
            <div className="mt-4 pt-4 border-t grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center">
                <p className="text-xs text-muted-foreground">Average Value</p>
                <p className="text-sm font-semibold">${formatNumber(profitAnalytics.avgValue, 2)}</p>
              </div>
              <div className="text-center">
                <p className="text-xs text-muted-foreground">Data Points</p>
                <p className="text-sm font-semibold">{profitAnalytics.dataPoints}</p>
              </div>
              <div className="text-center">
                <p className="text-xs text-muted-foreground">Period Start</p>
                <p className="text-xs font-mono">{new Date(profitAnalytics.startTime).toLocaleString()}</p>
              </div>
              <div className="text-center">
                <p className="text-xs text-muted-foreground">Period End</p>
                <p className="text-xs font-mono">{new Date(profitAnalytics.endTime).toLocaleString()}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Profit Analytics - Stablecoins Only */}
      {profitAnalyticsStablecoins && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {profitAnalyticsStablecoins.profitLoss >= 0 ? (
                <TrendingUp className="h-5 w-5 text-green-600" />
              ) : (
                <TrendingDown className="h-5 w-5 text-red-600" />
              )}
              Stablecoins P/L (USD + USDT) - {customDays ? `Last ${customDays} Days` : timeRange.toUpperCase()}
            </CardTitle>
            <CardDescription>
              Performance metrics for stablecoins only (excluding RLB value) - ({formatDuration(profitAnalyticsStablecoins.totalHours)})
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {/* Profit/Loss */}
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Total P/L</p>
                <p className={cn('text-2xl font-bold', getProfitLossColor(profitAnalyticsStablecoins.profitLoss))}>
                  {formatProfitLoss(profitAnalyticsStablecoins.profitLoss)}
                </p>
                <p className={cn('text-sm font-medium', getProfitLossColor(profitAnalyticsStablecoins.profitLoss))}>
                  {formatPercent(profitAnalyticsStablecoins.profitLossPercent)}
                </p>
              </div>

              {/* Profit Per Hour */}
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Profit/Hour</p>
                <p className={cn('text-2xl font-bold', getProfitLossColor(profitAnalyticsStablecoins.profitPerHour))}>
                  {formatProfitLoss(profitAnalyticsStablecoins.profitPerHour)}
                </p>
                <p className="text-xs text-muted-foreground">
                  Per day: {formatProfitLoss(profitAnalyticsStablecoins.profitPerDay)}
                </p>
              </div>

              {/* Start/End Values */}
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Start → End</p>
                <p className="text-lg font-semibold">
                  ${formatNumber(profitAnalyticsStablecoins.startValue, 2)}
                </p>
                <p className="text-lg font-semibold text-primary">
                  ${formatNumber(profitAnalyticsStablecoins.endValue, 2)}
                </p>
              </div>

              {/* Range & Volatility */}
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Range</p>
                <p className="text-sm">
                  <span className="text-green-600 font-semibold">High: ${formatNumber(profitAnalyticsStablecoins.maxValue, 2)}</span>
                </p>
                <p className="text-sm">
                  <span className="text-red-600 font-semibold">Low: ${formatNumber(profitAnalyticsStablecoins.minValue, 2)}</span>
                </p>
                <p className="text-xs text-muted-foreground">
                  Volatility: ±${formatNumber(profitAnalyticsStablecoins.volatility, 2)}
                </p>
              </div>
            </div>

            {/* Additional Metrics */}
            <div className="mt-4 pt-4 border-t grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center">
                <p className="text-xs text-muted-foreground">Average Value</p>
                <p className="text-sm font-semibold">${formatNumber(profitAnalyticsStablecoins.avgValue, 2)}</p>
              </div>
              <div className="text-center">
                <p className="text-xs text-muted-foreground">Data Points</p>
                <p className="text-sm font-semibold">{profitAnalyticsStablecoins.dataPoints}</p>
              </div>
              <div className="text-center">
                <p className="text-xs text-muted-foreground">Period Start</p>
                <p className="text-xs font-mono">{new Date(profitAnalyticsStablecoins.startTime).toLocaleString()}</p>
              </div>
              <div className="text-center">
                <p className="text-xs text-muted-foreground">Period End</p>
                <p className="text-xs font-mono">{new Date(profitAnalyticsStablecoins.endTime).toLocaleString()}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Detailed Balance Breakdown */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle>On-Site Balance</CardTitle>
            <CardDescription>Casino/exchange balance</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">USD:</span>
              <span className="font-semibold">${formatNumber(currentBalance.onsite_usd || 0, 2)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">RLB:</span>
              <span className="font-semibold">{formatNumber(currentBalance.onsite_rlb || 0, 2)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">RLB Value (USD):</span>
              <span className="font-semibold">${formatNumber(currentBalance.onsite_rlb_value_usd || 0, 2)}</span>
            </div>
            <div className="pt-2 border-t flex justify-between items-center">
              <span className="text-sm font-semibold">Total:</span>
              <span className="font-bold text-lg text-green-600">
                ${formatNumber(currentBalance.onsite_total_usd || 0, 2)}
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>On-Chain Balance</CardTitle>
            <CardDescription>Wallet/blockchain balance</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">USDT:</span>
              <span className="font-semibold">${formatNumber(currentBalance.onchain_usdt || 0, 2)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">RLB:</span>
              <span className="font-semibold">{formatNumber(currentBalance.onchain_rlb || 0, 2)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">RLB Value (USD):</span>
              <span className="font-semibold">${formatNumber(currentBalance.onchain_rlb_value_usd || 0, 2)}</span>
            </div>
            <div className="pt-2 border-t flex justify-between items-center">
              <span className="text-sm font-semibold">Total:</span>
              <span className="font-bold text-lg text-blue-600">
                ${formatNumber(currentBalance.onchain_total_usd || 0, 2)}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Total USD Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Total USD (All Assets)</CardTitle>
          <CardDescription>
            Real-time tracking of total balance across all assets in USD
            {filteredHistory.length > 0 && (() => {
              const pricesWithData = filteredHistory
                .filter(h => h.rlb_price_usd && h.rlb_price_usd > 0)
                .map(h => h.rlb_price_usd!);

              if (pricesWithData.length > 0) {
                const minPrice = Math.min(...pricesWithData);
                const maxPrice = Math.max(...pricesWithData);
                const avgPrice = pricesWithData.reduce((a, b) => a + b, 0) / pricesWithData.length;

                return (
                  <span className="block mt-1 text-xs">
                    RLB Price Range: ${minPrice.toFixed(6)} - ${maxPrice.toFixed(6)} (avg: ${avgPrice.toFixed(6)})
                  </span>
                );
              }
              return null;
            })()}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center h-[400px]">
              <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : chartDataUsd.length === 0 ? (
            <div className="flex items-center justify-center h-[400px] text-muted-foreground">
              No data available
            </div>
          ) : (
            <TradingViewChart
              key={`usd-${timeRange}-${customDays}-${chartDataUsd.length}`}
              data={chartDataUsd}
              secondaryData={chartDataRlbPrice}
              color="#2962FF"
              secondaryColor="#FF6B35"
              height={400}
              valueFormatter={(value) => `$${value.toFixed(2)}`}
              secondaryFormatter={(value) => `RLB: $${value.toFixed(6)}`}
              showSecondary={chartDataRlbPrice.length > 0}
            />
          )}
        </CardContent>
      </Card>

      {/* USD + USDT Chart */}
      <Card>
        <CardHeader>
          <CardTitle>USD + USDT (Stablecoins)</CardTitle>
          <CardDescription>
            Real-time tracking of stablecoin balance
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center h-[400px]">
              <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : chartDataUsdUsdt.length === 0 ? (
            <div className="flex items-center justify-center h-[400px] text-muted-foreground">
              No data available
            </div>
          ) : (
            <TradingViewChart
              key={`usdt-${timeRange}-${customDays}-${chartDataUsdUsdt.length}`}
              data={chartDataUsdUsdt}
              color="#26a69a"
              height={400}
              valueFormatter={(value) => `$${value.toFixed(2)}`}
            />
          )}
        </CardContent>
      </Card>

      {/* Total RLB Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Total RLB (Tokens)</CardTitle>
          <CardDescription>
            Real-time tracking of RLB token balance
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center h-[400px]">
              <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : chartDataRlb.length === 0 ? (
            <div className="flex items-center justify-center h-[400px] text-muted-foreground">
              No data available
            </div>
          ) : (
            <TradingViewChart
              key={`rlb-${timeRange}-${customDays}-${chartDataRlb.length}`}
              data={chartDataRlb}
              color="#ef5350"
              height={400}
              valueFormatter={(value) => `${value.toFixed(2)} RLB`}
            />
          )}
        </CardContent>
      </Card>

      {/* Data Info */}
      <Card>
        <CardHeader>
          <CardTitle>Data Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground">Total Snapshots:</span>
            <span className="font-semibold">{combinedHistory.length}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground">Historical Data:</span>
            <span className="font-semibold">{history.length}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground">Live Updates:</span>
            <span className="font-semibold">{liveHistory.length}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground">Displayed Data Points:</span>
            <span className="font-semibold">{filteredHistory.length}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground">Snapshots with RLB Price:</span>
            <span className="font-semibold">
              {filteredHistory.filter(h => h.rlb_price_usd && h.rlb_price_usd > 0).length} / {filteredHistory.length}
            </span>
          </div>
          {currentBalance.rlb_price_last_updated && (
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Current RLB Price:</span>
              <span className="font-semibold text-xs">
                ${currentBalance.rlb_price_usd.toFixed(6)} (updated: {new Date(currentBalance.rlb_price_last_updated).toLocaleString()})
              </span>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
