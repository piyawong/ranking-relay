'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import TradingViewChart, { TradeMarker } from '@/components/TradingViewChart';
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
  AlertTriangle,
  Swords,
  Trophy,
  Target
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
async function fetchHighDiffSnapshots(limit: number = 50, fastMode: boolean = true) {
  const response = await fetch(`/api/balance/high-diff?limit=${limit}&fast=${fastMode}`);
  if (!response.ok) throw new Error('Failed to fetch high diff snapshots');
  const data = await response.json();
  return data.data;
}

// Batch delete high diff snapshots
async function batchDeleteSnapshots(snapshotIds: string[]) {
  const response = await fetch('/api/balance/high-diff/delete', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ snapshotIds })
  });
  if (!response.ok) throw new Error('Failed to batch delete snapshots');
  return response.json();
}

// Fetch all spikes for manual review
async function fetchAllSpikes() {
  const response = await fetch('/api/balance/spikes');
  if (!response.ok) throw new Error('Failed to fetch spikes');
  const data = await response.json();
  return data.data;
}

// Fetch trades for chart markers and P/L analytics
async function fetchTrades() {
  const response = await fetch('/api/trades');
  if (!response.ok) throw new Error('Failed to fetch trades');
  const data = await response.json();
  return { trades: data.trades || [], statistics: data.statistics || null };
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

  // Fetch trades for chart markers and P/L analytics
  const { data: tradesData } = useQuery({
    queryKey: ['trades-for-chart'],
    queryFn: fetchTrades,
    refetchInterval: 30000, // Refresh trades every 30 seconds
  });

  // Extract trades and statistics
  const allTrades = tradesData?.trades || [];
  const tradeStatistics = tradesData?.statistics || null;

  // Filter trades by selected time range
  const trades = useMemo(() => {
    if (!allTrades || allTrades.length === 0) return [];

    // If custom days is set and valid, use that
    const parsedCustomDays = parseInt(customDays, 10);
    if (customDays && !isNaN(parsedCustomDays) && parsedCustomDays > 0) {
      const cutoffTime = new Date();
      cutoffTime.setDate(cutoffTime.getDate() - parsedCustomDays);
      return allTrades.filter((t: any) => new Date(t.timestamp) >= cutoffTime);
    }

    if (timeRange === 'all') return allTrades;

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
        return allTrades;
    }

    return allTrades.filter((t: any) => new Date(t.timestamp) >= cutoffTime);
  }, [allTrades, timeRange, customDays]);

  // Calculate cumulative P/L chart data from trades (using actual USD profit)
  // Returns both raw profit (without gas) and profit with gas
  // Includes regular time intervals for proper chart display
  const { tradePnLChartData, tradePnLRawChartData } = useMemo(() => {
    // Determine the time range for the chart
    const now = new Date();
    let startTime = new Date();
    let intervalMs = 60000; // Default: 1 minute

    const parsedCustomDays = parseInt(customDays, 10);
    if (customDays && !isNaN(parsedCustomDays) && parsedCustomDays > 0) {
      startTime.setDate(now.getDate() - parsedCustomDays);
      if (parsedCustomDays <= 1) intervalMs = 60000; // 1 minute
      else if (parsedCustomDays <= 7) intervalMs = 300000; // 5 minutes
      else intervalMs = 900000; // 15 minutes
    } else {
      switch (timeRange) {
        case '1h':
          startTime.setHours(now.getHours() - 1);
          intervalMs = 60000; // 1 minute
          break;
        case '6h':
          startTime.setHours(now.getHours() - 6);
          intervalMs = 60000; // 1 minute
          break;
        case '24h':
          startTime.setHours(now.getHours() - 24);
          intervalMs = 120000; // 2 minutes
          break;
        case '7d':
          startTime.setDate(now.getDate() - 7);
          intervalMs = 300000; // 5 minutes
          break;
        case '30d':
          startTime.setDate(now.getDate() - 30);
          intervalMs = 900000; // 15 minutes
          break;
        case 'all':
          // For 'all', use first trade time or 24h ago
          if (trades && trades.length > 0) {
            const sortedTrades = [...trades].sort(
              (a: any, b: any) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
            );
            startTime = new Date(sortedTrades[0].timestamp);
            const spanMs = now.getTime() - startTime.getTime();
            const spanDays = spanMs / (1000 * 60 * 60 * 24);
            if (spanDays <= 1) intervalMs = 60000;
            else if (spanDays <= 7) intervalMs = 300000;
            else intervalMs = 900000;
          } else {
            startTime.setHours(now.getHours() - 24);
            intervalMs = 120000;
          }
          break;
      }
    }

    // Generate time intervals
    const startMs = startTime.getTime();
    const endMs = now.getTime();

    // Sort trades by timestamp
    const sortedTrades = trades && trades.length > 0
      ? [...trades].sort((a: any, b: any) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
      : [];

    // Build cumulative values at each trade
    const tradeEvents: { time: number; netProfit: number; rawProfit: number }[] = [];
    let cumulativeNet = 0;
    let cumulativeRaw = 0;

    sortedTrades.forEach((trade: any) => {
      const tradeTime = new Date(trade.timestamp).getTime();
      if (trade.profit_with_gas_usd !== null) {
        cumulativeNet += trade.profit_with_gas_usd;
      }
      if (trade.raw_profit_usd !== null) {
        cumulativeRaw += trade.raw_profit_usd;
      }
      tradeEvents.push({ time: tradeTime, netProfit: cumulativeNet, rawProfit: cumulativeRaw });
    });

    // Generate chart data with regular intervals
    const withGasData: { time: number; value: number }[] = [];
    const rawData: { time: number; value: number }[] = [];

    let currentNet = 0;
    let currentRaw = 0;
    let tradeIndex = 0;

    for (let t = startMs; t <= endMs; t += intervalMs) {
      // Apply all trades that happened before or at this time
      while (tradeIndex < tradeEvents.length && tradeEvents[tradeIndex].time <= t) {
        currentNet = tradeEvents[tradeIndex].netProfit;
        currentRaw = tradeEvents[tradeIndex].rawProfit;
        tradeIndex++;
      }

      const timeSeconds = Math.floor(t / 1000);
      withGasData.push({ time: timeSeconds, value: currentNet });
      rawData.push({ time: timeSeconds, value: currentRaw });
    }

    // Make sure to include the final values at current time
    const finalTimeSeconds = Math.floor(endMs / 1000);
    if (withGasData.length === 0 || withGasData[withGasData.length - 1].time < finalTimeSeconds) {
      withGasData.push({ time: finalTimeSeconds, value: currentNet });
      rawData.push({ time: finalTimeSeconds, value: currentRaw });
    }

    return { tradePnLChartData: withGasData, tradePnLRawChartData: rawData };
  }, [trades, timeRange, customDays]);

  // Calculate trade USD profit statistics (both raw and with gas)
  const tradeProfitStats = useMemo(() => {
    // Return empty stats instead of null so we can still show the card
    const emptyStats = {
      totalNetProfit: 0,
      totalRawProfit: 0,
      totalGasCost: 0,
      avgNetProfit: 0,
      avgRawProfit: 0,
      tradesWithProfit: 0,
      tradesWithNetProfit: 0,
      tradesWithRawProfit: 0,
      profitableTrades: 0,
      unprofitableTrades: 0,
      totalGained: 0,
      totalLost: 0,
      avgGain: 0,
      avgLoss: 0,
      totalHours: 0,
      startTime: null as string | null,
      endTime: null as string | null,
      netProfitPerHour: 0,
      netProfitPerDay: 0,
      rawProfitPerHour: 0,
      rawProfitPerDay: 0,
      netHigh: 0,
      netLow: 0,
      netAvg: 0,
      rawHigh: 0,
      rawLow: 0,
      rawAvg: 0,
      netVolatility: 0,
      wins: 0,
      losses: 0,
      winRate: null as number | null,
      totalTrades: 0,
      avgApiDuration: null as number | null,
    };

    if (!trades || trades.length === 0) return emptyStats;

    const tradesWithProfit = trades.filter((t: any) =>
      t.profit_with_gas_usd !== null || t.raw_profit_usd !== null
    );

    if (tradesWithProfit.length === 0) return { ...emptyStats, totalTrades: trades.length };

    // Sort by timestamp for period calculations
    const sortedTrades = [...tradesWithProfit].sort(
      (a: any, b: any) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );

    // Net profit (with gas)
    const netProfits = tradesWithProfit
      .filter((t: any) => t.profit_with_gas_usd !== null)
      .map((t: any) => t.profit_with_gas_usd);
    const totalNetProfit = netProfits.reduce((sum: number, p: number) => sum + p, 0);

    // Raw profit (without gas)
    const rawProfits = tradesWithProfit
      .filter((t: any) => t.raw_profit_usd !== null)
      .map((t: any) => t.raw_profit_usd);
    const totalRawProfit = rawProfits.reduce((sum: number, p: number) => sum + p, 0);

    // Gas costs (difference between raw and net)
    const totalGasCost = totalRawProfit - totalNetProfit;

    const avgNetProfit = netProfits.length > 0 ? totalNetProfit / netProfits.length : 0;
    const avgRawProfit = rawProfits.length > 0 ? totalRawProfit / rawProfits.length : 0;

    // For gains/losses, use net profit
    const positiveProfit = netProfits.filter((p: number) => p > 0);
    const negativeProfit = netProfits.filter((p: number) => p < 0);

    // Period calculations
    const firstTrade = sortedTrades[0];
    const lastTrade = sortedTrades[sortedTrades.length - 1];
    const startTime = new Date(firstTrade.timestamp);
    const endTime = new Date(lastTrade.timestamp);
    const totalMilliseconds = endTime.getTime() - startTime.getTime();
    const totalHours = totalMilliseconds / (1000 * 60 * 60);

    // Profit per hour/day (net)
    const netProfitPerHour = totalHours > 0 ? totalNetProfit / totalHours : 0;
    const netProfitPerDay = netProfitPerHour * 24;

    // Profit per hour/day (raw)
    const rawProfitPerHour = totalHours > 0 ? totalRawProfit / totalHours : 0;
    const rawProfitPerDay = rawProfitPerHour * 24;

    // Calculate cumulative values for high/low/avg
    let cumulativeNet = 0;
    let cumulativeRaw = 0;
    const cumulativeNetValues: number[] = [];
    const cumulativeRawValues: number[] = [];

    sortedTrades.forEach((t: any) => {
      if (t.profit_with_gas_usd !== null) {
        cumulativeNet += t.profit_with_gas_usd;
        cumulativeNetValues.push(cumulativeNet);
      }
      if (t.raw_profit_usd !== null) {
        cumulativeRaw += t.raw_profit_usd;
        cumulativeRawValues.push(cumulativeRaw);
      }
    });

    const netHigh = cumulativeNetValues.length > 0 ? Math.max(...cumulativeNetValues) : 0;
    const netLow = cumulativeNetValues.length > 0 ? Math.min(...cumulativeNetValues) : 0;
    const netAvg = cumulativeNetValues.length > 0 ? cumulativeNetValues.reduce((a, b) => a + b, 0) / cumulativeNetValues.length : 0;

    const rawHigh = cumulativeRawValues.length > 0 ? Math.max(...cumulativeRawValues) : 0;
    const rawLow = cumulativeRawValues.length > 0 ? Math.min(...cumulativeRawValues) : 0;
    const rawAvg = cumulativeRawValues.length > 0 ? cumulativeRawValues.reduce((a, b) => a + b, 0) / cumulativeRawValues.length : 0;

    // Volatility (standard deviation of cumulative net)
    const netVariance = cumulativeNetValues.length > 0
      ? cumulativeNetValues.reduce((sum, val) => sum + Math.pow(val - netAvg, 2), 0) / cumulativeNetValues.length
      : 0;
    const netVolatility = Math.sqrt(netVariance);

    // Calculate wins/losses for filtered trades
    const wins = trades.filter((t: any) => t.win === true || !t.opponent).length;
    const losses = trades.filter((t: any) => t.win === false && t.opponent).length;
    const winRate = (wins + losses) > 0 ? (wins / (wins + losses)) * 100 : null;

    // Calculate avg API duration for filtered trades
    const tradesWithDuration = trades.filter((t: any) => t.api_call_duration_ms !== null);
    const avgApiDuration = tradesWithDuration.length > 0
      ? tradesWithDuration.reduce((sum: number, t: any) => sum + t.api_call_duration_ms, 0) / tradesWithDuration.length
      : null;

    return {
      totalNetProfit,
      totalRawProfit,
      totalGasCost,
      avgNetProfit,
      avgRawProfit,
      tradesWithProfit: tradesWithProfit.length,
      tradesWithNetProfit: netProfits.length,
      tradesWithRawProfit: rawProfits.length,
      profitableTrades: positiveProfit.length,
      unprofitableTrades: negativeProfit.length,
      totalGained: positiveProfit.reduce((sum: number, p: number) => sum + p, 0),
      totalLost: Math.abs(negativeProfit.reduce((sum: number, p: number) => sum + p, 0)),
      avgGain: positiveProfit.length > 0 ? positiveProfit.reduce((sum: number, p: number) => sum + p, 0) / positiveProfit.length : 0,
      avgLoss: negativeProfit.length > 0 ? Math.abs(negativeProfit.reduce((sum: number, p: number) => sum + p, 0) / negativeProfit.length) : 0,
      // Period stats
      totalHours,
      startTime: firstTrade.timestamp,
      endTime: lastTrade.timestamp,
      netProfitPerHour,
      netProfitPerDay,
      rawProfitPerHour,
      rawProfitPerDay,
      netHigh,
      netLow,
      netAvg,
      rawHigh,
      rawLow,
      rawAvg,
      netVolatility,
      // Win/Loss stats for filtered period
      wins,
      losses,
      winRate,
      totalTrades: trades.length,
      avgApiDuration,
    };
  }, [trades]);

  // Convert trades to chart markers
  const tradeMarkers: TradeMarker[] = useMemo(() => {
    if (!trades || trades.length === 0) return [];

    return trades.map((trade: any) => {
      const timestamp = Math.floor(new Date(trade.timestamp).getTime() / 1000);
      const hasOpponent = trade.opponent === true;
      const isLoss = trade.win === false && hasOpponent;
      const timeGap = trade.opponent_time_gap_ms;
      const amount = (trade.trade_amount_rlb / 1000).toFixed(0);

      // Simple logic: Loss = red, everything else = WIN (green)
      let color: string;
      let text: string;

      if (isLoss) {
        // Lost to opponent
        color = '#ef4444'; // red
        const timeText = timeGap ? `-${timeGap.toFixed(1)}ms` : '';
        text = `⚔️ ${amount}k LOSS ${timeText}`;
      } else {
        // Win (either beat opponent or no opponent = auto win)
        color = '#22c55e'; // green
        const timeText = hasOpponent && timeGap ? `+${timeGap.toFixed(1)}ms` : '';
        text = `⚔️ ${amount}k WIN ${timeText}`;
      }

      return {
        time: timestamp,
        position: 'aboveBar' as const,
        color: color,
        shape: 'circle' as const,
        text: text,
        size: 2,
      };
    });
  }, [tradesData]);

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

  // RLB Price data for secondary chart series (in cents, multiplied by 100)
  const chartDataRlbPrice = useMemo(() => {
    if (useMockData) return generateMockData(7.5, 200); // Mock data in cents

    return downsampledHistory
      .filter((item) => item && item.rlb_price_usd != null && !isNaN(item.rlb_price_usd) && isFinite(item.rlb_price_usd) && item.rlb_price_usd > 0)
      .map((item) => ({
        time: Math.floor(new Date(item.timestamp).getTime() / 1000),
        value: item.rlb_price_usd! * 100 // Convert to cents
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

  // Handle remove high diff snapshots (OPTIMIZED)
  const handleRemoveHighDiff = async () => {
    try {
      setIsCleaningHighDiff(true);
      let totalDeleted = 0;
      let iteration = 0;
      const maxIterations = 100; // Safety limit (increased for cascading anomalies)

      while (iteration < maxIterations) {
        // Fetch current high diff snapshots (OPTIMIZED: limit=100, fast mode)
        const highDiffData = await fetchHighDiffSnapshots(100, true);
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
            `Found ${highDiffSnapshots.length}+ snapshots with abnormal changes:\n\n${detailsText}${moreText}\n\n` +
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

        // OPTIMIZED: Batch delete all at once instead of one-by-one
        try {
          const result = await batchDeleteSnapshots(highDiffSnapshots);
          totalDeleted += result.data.deletedCount;
          setCleanupProgress({ current: totalDeleted, total: totalDeleted });
          console.log(`Batch ${iteration + 1}: Deleted ${result.data.deletedCount} snapshots`);
        } catch (error) {
          console.error('Batch delete failed:', error);
          break;
        }

        iteration++;

        // Small delay between iterations
        await new Promise(resolve => setTimeout(resolve, 200));
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
        <div className="flex items-center gap-3 flex-wrap ">
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

      {/* Trade Performance P/L */}
      {allTrades && allTrades.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Swords className="h-5 w-5 text-purple-600" />
              Trade Performance P/L - {customDays ? `Last ${customDays} Days` : timeRange.toUpperCase()}
            </CardTitle>
            <CardDescription>
              Cumulative USD profit from {tradeProfitStats?.tradesWithProfit || 0} trades in selected period ({tradeProfitStats ? formatDuration(tradeProfitStats.totalHours) : 'N/A'})
            </CardDescription>
          </CardHeader>
          <CardContent>
            {/* No trades message */}
            {tradeProfitStats?.totalTrades === 0 && (
              <div className="bg-muted/50 rounded-lg p-4 mb-6 text-center">
                <p className="text-muted-foreground">
                  No trades in {customDays ? `last ${customDays} days` : `last ${timeRange === '1h' ? '1 hour' : timeRange === '6h' ? '6 hours' : timeRange === '24h' ? '24 hours' : timeRange === '7d' ? '7 days' : timeRange === '30d' ? '30 days' : 'selected period'}`}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Total trades (all time): {allTrades.length}
                </p>
              </div>
            )}

            {/* Trade Stats Grid - Row 1: Main P/L stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-6">
              {/* Raw P/L (no gas) */}
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground flex items-center gap-1">
                  <div className="w-2 h-2 rounded-full bg-orange-500" /> Raw P/L
                </p>
                <p className={cn('text-2xl font-bold', (tradeProfitStats?.totalRawProfit || 0) >= 0 ? 'text-orange-500' : 'text-red-600')}>
                  {(tradeProfitStats?.totalRawProfit || 0) >= 0 ? '+' : ''}${formatNumber(tradeProfitStats?.totalRawProfit || 0, 2)}
                </p>
                <p className="text-xs text-muted-foreground">
                  Per hour: {(tradeProfitStats?.rawProfitPerHour || 0) >= 0 ? '+' : ''}${formatNumber(tradeProfitStats?.rawProfitPerHour || 0, 2)}
                </p>
                <p className="text-xs text-muted-foreground">
                  Per day: {(tradeProfitStats?.rawProfitPerDay || 0) >= 0 ? '+' : ''}${formatNumber(tradeProfitStats?.rawProfitPerDay || 0, 2)}
                </p>
              </div>

              {/* Net P/L (with gas) */}
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground flex items-center gap-1">
                  <div className={cn('w-2 h-2 rounded-full', (tradeProfitStats?.totalNetProfit || 0) >= 0 ? 'bg-green-500' : 'bg-red-500')} /> Net P/L
                </p>
                <p className={cn('text-2xl font-bold', (tradeProfitStats?.totalNetProfit || 0) >= 0 ? 'text-green-600' : 'text-red-600')}>
                  {(tradeProfitStats?.totalNetProfit || 0) >= 0 ? '+' : ''}${formatNumber(tradeProfitStats?.totalNetProfit || 0, 2)}
                </p>
                <p className="text-xs text-muted-foreground">
                  Per hour: {(tradeProfitStats?.netProfitPerHour || 0) >= 0 ? '+' : ''}${formatNumber(tradeProfitStats?.netProfitPerHour || 0, 2)}
                </p>
                <p className="text-xs text-muted-foreground">
                  Per day: {(tradeProfitStats?.netProfitPerDay || 0) >= 0 ? '+' : ''}${formatNumber(tradeProfitStats?.netProfitPerDay || 0, 2)}
                </p>
              </div>

              {/* Gas Costs */}
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Gas Spent</p>
                <p className="text-2xl font-bold text-red-500">
                  -${formatNumber(tradeProfitStats?.totalGasCost || 0, 2)}
                </p>
                <p className="text-xs text-muted-foreground">
                  total fees
                </p>
              </div>

              {/* Win Rate */}
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground flex items-center gap-1">
                  <Trophy className="h-3 w-3" /> Win Rate
                </p>
                <p className={cn('text-2xl font-bold', tradeProfitStats?.winRate !== null && (tradeProfitStats?.winRate || 0) >= 50 ? 'text-green-600' : 'text-red-600')}>
                  {tradeProfitStats?.winRate !== null ? `${tradeProfitStats.winRate.toFixed(1)}%` : 'N/A'}
                </p>
                <p className="text-xs text-muted-foreground">
                  {tradeProfitStats?.wins || 0}W / {tradeProfitStats?.losses || 0}L
                </p>
              </div>
            </div>

            {/* Trade Stats Grid - Row 2: Range & Period stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-6 pt-4 border-t">
              {/* Range (Net) */}
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Range (Net)</p>
                <p className="text-sm">
                  <span className="text-green-600 font-semibold">High: ${formatNumber(tradeProfitStats?.netHigh || 0, 2)}</span>
                </p>
                <p className="text-sm">
                  <span className="text-red-600 font-semibold">Low: ${formatNumber(tradeProfitStats?.netLow || 0, 2)}</span>
                </p>
                <p className="text-xs text-muted-foreground">
                  Volatility: ±${formatNumber(tradeProfitStats?.netVolatility || 0, 2)}
                </p>
              </div>

              {/* Avg per Trade */}
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Avg per Trade</p>
                <p className="text-sm">
                  <span className="text-orange-500 font-semibold">Raw: {(tradeProfitStats?.avgRawProfit || 0) >= 0 ? '+' : ''}${formatNumber(tradeProfitStats?.avgRawProfit || 0, 2)}</span>
                </p>
                <p className="text-sm">
                  <span className={cn('font-semibold', (tradeProfitStats?.avgNetProfit || 0) >= 0 ? 'text-green-600' : 'text-red-600')}>Net: {(tradeProfitStats?.avgNetProfit || 0) >= 0 ? '+' : ''}${formatNumber(tradeProfitStats?.avgNetProfit || 0, 2)}</span>
                </p>
              </div>

              {/* Period Start/End */}
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Period</p>
                <p className="text-xs font-mono">{tradeProfitStats?.startTime ? new Date(tradeProfitStats.startTime).toLocaleString() : 'N/A'}</p>
                <p className="text-xs font-mono">{tradeProfitStats?.endTime ? new Date(tradeProfitStats.endTime).toLocaleString() : 'N/A'}</p>
              </div>

              {/* Data Points & Response Speed */}
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Stats</p>
                <p className="text-sm">
                  <span className="font-semibold">{tradeProfitStats?.totalTrades || 0}</span> trades
                </p>
                <p className="text-sm">
                  <span className="text-blue-600 font-semibold">{tradeProfitStats?.avgApiDuration !== null ? `${tradeProfitStats.avgApiDuration.toFixed(0)}ms` : 'N/A'}</span> avg speed
                </p>
              </div>
            </div>

            {/* Cumulative P/L Chart - Raw (orange) vs With Gas (green/red) */}
            {(tradePnLChartData.length > 0 || tradePnLRawChartData.length > 0) ? (
              <>
                <div className="flex items-center gap-4 mb-2 text-xs">
                  <div className="flex items-center gap-1">
                    <div className="w-3 h-3 rounded-full bg-orange-500" />
                    <span className="text-muted-foreground">Raw Profit (no gas)</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className={cn('w-3 h-3 rounded-full', tradePnLChartData[tradePnLChartData.length - 1]?.value >= 0 ? 'bg-green-500' : 'bg-red-500')} />
                    <span className="text-muted-foreground">Net Profit (with gas)</span>
                  </div>
                </div>
                <TradingViewChart
                  key={`trade-pnl-${tradePnLChartData.length}-${tradePnLRawChartData.length}`}
                  data={tradePnLChartData.length > 0 ? tradePnLChartData : tradePnLRawChartData}
                  secondaryData={tradePnLRawChartData.length > 0 ? tradePnLRawChartData : undefined}
                  color={tradePnLChartData[tradePnLChartData.length - 1]?.value >= 0 ? '#22c55e' : '#ef4444'}
                  secondaryColor="#f97316"
                  height={300}
                  valueFormatter={(value) => `${value >= 0 ? '+' : ''}$${formatNumber(value, 2)}`}
                  secondaryFormatter={(value) => `Raw: ${value >= 0 ? '+' : ''}$${formatNumber(value, 2)}`}
                  showSecondary={tradePnLRawChartData.length > 0}
                />
              </>
            ) : (
              <div className="flex items-center justify-center h-[300px] text-muted-foreground">
                No trade profit data available yet
              </div>
            )}
          </CardContent>
        </Card>
      )}

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
              ${formatNumber(priceData?.price_usd || currentBalance.rlb_price_usd || 0, 5)}
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
                    RLB Price Range: ${minPrice.toFixed(5)} - ${maxPrice.toFixed(5)} (avg: ${avgPrice.toFixed(5)})
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
              key={`usd-${timeRange}-${customDays}-${chartDataUsd.length}-${tradeMarkers.length}`}
              data={chartDataUsd}
              secondaryData={chartDataRlbPrice}
              markers={tradeMarkers}
              color="#2962FF"
              secondaryColor="#FF6B35"
              height={400}
              valueFormatter={(value) => `$${value.toFixed(2)}`}
              secondaryFormatter={(value) => `RLB: ${value.toFixed(3)}¢`}
              showSecondary={chartDataRlbPrice.length > 0}
              showMarkers={true}
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
              key={`usdt-${timeRange}-${customDays}-${chartDataUsdUsdt.length}-${tradeMarkers.length}`}
              data={chartDataUsdUsdt}
              markers={tradeMarkers}
              color="#26a69a"
              height={400}
              valueFormatter={(value) => `$${value.toFixed(2)}`}
              showMarkers={true}
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
                ${currentBalance.rlb_price_usd.toFixed(5)} (updated: {new Date(currentBalance.rlb_price_last_updated).toLocaleString()})
              </span>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
