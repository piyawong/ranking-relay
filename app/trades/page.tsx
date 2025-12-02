'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertCircle, Clock, Trash2, CheckCircle2, XCircle, MinusCircle, RefreshCw, ExternalLink, ArrowUpRight, ArrowDownRight, Plus } from 'lucide-react';
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface Trade {
  id: string;
  trade_id: string | null;
  trade_number: number;
  timestamp: string;
  trigger_category: 'onchain' | 'onsite';
  trigger_type: 'fast_hook' | 'rollbit_price_update';
  block_number: number;
  slot_number: number | null;
  initial_reserves_rlb: number;
  trade_amount_rlb: number;
  direction: string | null;
  step1_action: string | null;
  step1_usd_value: number | null;
  onsite_value_usd: number | null;
  onsite_value_with_fee: number | null;
  tx_hash: string | null;
  onchain_usd_value: number | null;
  gas_used_usd: number | null;
  raw_profit_usd: number | null;
  profit_with_gas_usd: number | null;
  api_call_duration_ms: number | null;
  opponent: boolean;
  priority_gwei: number | null;
  opponent_trades_count: number | null;
  opponent_time_gap_ms: number | null;
  trade_logs: string[];
  win: boolean | null;
  // Block/Bloxroute comparison data
  first_relay: string | null;
  bloxroute_origin: string | null;
  bloxroute_comparison: {
    is_win_relay: boolean | null;
    time_diff_ms: number | null;
  };
}


interface Statistics {
  total_trades: number;
  by_trigger_category: {
    onchain: number;
    onsite: number;
  };
  by_trigger_type: {
    fast_hook: number;
    rollbit_price_update: number;
  };
  by_trade_amount: Record<string, number>;
  total_volume_rlb: number;
  with_opponent: number;
  without_opponent: number;
  wins: number;
  losses: number;
  win_rate: number | null;
  // Win amount stats
  min_win_amount: number | null;
  max_win_amount: number | null;
  avg_win_amount: number | null;
  total_win_volume: number;
  // Loss amount stats
  min_loss_amount: number | null;
  max_loss_amount: number | null;
  avg_loss_amount: number | null;
  total_loss_volume: number;
  // Win time gap stats (ms faster than opponent)
  min_win_time_gap_ms: number | null;
  max_win_time_gap_ms: number | null;
  avg_win_time_gap_ms: number | null;
  // Loss time gap stats (ms slower than opponent)
  min_loss_time_gap_ms: number | null;
  max_loss_time_gap_ms: number | null;
  avg_loss_time_gap_ms: number | null;
  // API stats
  avg_api_duration_ms: number | null;
  min_api_duration_ms: number | null;
  max_api_duration_ms: number | null;
  avg_priority_gwei_with_opponent: number | null;
  avg_priority_gwei_without_opponent: number | null;
  avg_opponent_time_gap_ms: number | null;
  avg_api_duration_by_category: {
    onchain: number | null;
    onsite: number | null;
  };
}

export default function TradePage() {
  const router = useRouter();
  const [trades, setTrades] = useState<Trade[]>([]);
  const [statistics, setStatistics] = useState<Statistics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [triggerCategory, setTriggerCategory] = useState<string>('all');
  const [opponentFilter, setOpponentFilter] = useState<string>('all');
  const [winFilter, setWinFilter] = useState<string>('all');
  const [deletingTrade, setDeletingTrade] = useState<string | null>(null);
  const [deletingAll, setDeletingAll] = useState(false);

  // Add Trade Modal
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [newTrade, setNewTrade] = useState({
    trigger_category: 'onchain',
    trigger_type: 'fast_hook',
    block_number: '',
    trade_amount_rlb: '',
    direction: 'buy_onsite_sell_onchain',
    step1_action: 'buy',
    onsite_value_with_fee: '',
    tx_hash: '',
    onchain_usd_value: '',
    gas_used_usd: '',
    opponent: false,
    win: true,
  });

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const tradesPerPage = 20;

  const fetchTrades = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams();
      if (triggerCategory !== 'all') params.append('trigger_category', triggerCategory);
      if (opponentFilter !== 'all') params.append('has_opponent', opponentFilter);
      if (winFilter !== 'all') params.append('is_win', winFilter);

      const response = await fetch(`/api/trades?${params}`);
      if (!response.ok) throw new Error('Failed to fetch trades');

      const data = await response.json();
      setTrades(data.trades);
      setStatistics(data.statistics);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  }, [triggerCategory, opponentFilter, winFilter]);

  useEffect(() => {
    fetchTrades();
  }, [fetchTrades]);

  const formatDuration = (ms: number | null) => {
    if (ms === null) return 'N/A';
    if (ms < 1000) return `${ms.toFixed(2)}ms`;
    return `${(ms / 1000).toFixed(2)}s`;
  };

  const formatRelativeTime = (timestamp: string) => {
    const now = new Date();
    const time = new Date(timestamp);
    const diffMs = now.getTime() - time.getTime();
    const diffSeconds = Math.floor(diffMs / 1000);
    const diffMinutes = Math.floor(diffSeconds / 60);
    const diffHours = Math.floor(diffMinutes / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffSeconds < 60) {
      return `${diffSeconds}s ago`;
    } else if (diffMinutes < 60) {
      return `${diffMinutes}m ago`;
    } else if (diffHours < 24) {
      return `${diffHours}h ago`;
    } else if (diffDays < 7) {
      return `${diffDays}d ago`;
    } else {
      return time.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric'
      });
    }
  };

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat('en-US').format(num);
  };

  const formatUSD = (value: number | null) => {
    if (value === null) return '-';
    return `$${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const getDirectionIcon = (direction: string | null) => {
    if (direction === 'buy_onsite_sell_onchain') {
      return <ArrowUpRight className="h-4 w-4 text-green-500" />;
    } else if (direction === 'sell_onsite_buy_onchain') {
      return <ArrowDownRight className="h-4 w-4 text-blue-500" />;
    }
    return null;
  };

  const shortenHash = (hash: string | null) => {
    if (!hash) return '-';
    return `${hash.slice(0, 6)}...${hash.slice(-4)}`;
  };

  const handleDeleteTrade = async (tradeId: string) => {
    if (!window.confirm('Are you sure you want to delete this trade? This action cannot be undone.')) {
      return;
    }

    try {
      setDeletingTrade(tradeId);
      const response = await fetch(`/api/trades?id=${tradeId}`, {
        method: 'DELETE'
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to delete trade');
      }

      // Refresh trades list
      await fetchTrades();
      alert('Trade deleted successfully');
    } catch (err) {
      console.error('Delete error:', err);
      alert(err instanceof Error ? err.message : 'Failed to delete trade');
    } finally {
      setDeletingTrade(null);
    }
  };

  const handleDeleteAllTrades = async () => {
    if (!window.confirm(`Are you sure you want to delete ALL ${trades.length} trades? This action cannot be undone.`)) {
      return;
    }

    try {
      setDeletingAll(true);
      const response = await fetch('/api/trades?all=true', {
        method: 'DELETE'
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to delete all trades');
      }

      const result = await response.json();
      alert(`${result.deletedCount} trades deleted successfully`);

      // Refresh trades list
      await fetchTrades();
    } catch (err) {
      console.error('Delete all error:', err);
      alert(err instanceof Error ? err.message : 'Failed to delete all trades');
    } finally {
      setDeletingAll(false);
    }
  };

  const handleAddTrade = async () => {
    if (!newTrade.block_number || !newTrade.trade_amount_rlb) {
      alert('Block number and trade amount are required');
      return;
    }

    try {
      setIsSubmitting(true);

      // Calculate profit if we have both onsite and onchain values
      let rawProfit = null;
      let profitWithGas = null;
      const onsiteVal = newTrade.onsite_value_with_fee ? parseFloat(newTrade.onsite_value_with_fee) : null;
      const onchainVal = newTrade.onchain_usd_value ? parseFloat(newTrade.onchain_usd_value) : null;
      const gasVal = newTrade.gas_used_usd ? parseFloat(newTrade.gas_used_usd) : 0;

      if (onsiteVal !== null && onchainVal !== null) {
        if (newTrade.direction === 'buy_onsite_sell_onchain') {
          // Buy onsite (spend USD), sell onchain (receive USD)
          rawProfit = onchainVal - onsiteVal;
        } else {
          // Sell onsite (receive USD), buy onchain (spend USD)
          rawProfit = onsiteVal - onchainVal;
        }
        profitWithGas = rawProfit - gasVal;
      }

      const tradeData = {
        trade_id: `manual-${Date.now()}`,
        timestamp: new Date().toISOString(),
        trigger_category: newTrade.trigger_category,
        trigger_type: newTrade.trigger_type,
        block_number: parseInt(newTrade.block_number),
        initial_reserves_rlb: 0,
        trade_amount_rlb: parseFloat(newTrade.trade_amount_rlb),
        direction: newTrade.direction,
        step1_action: newTrade.step1_action,
        onsite_value_with_fee: onsiteVal,
        tx_hash: newTrade.tx_hash || null,
        onchain_usd_value: onchainVal,
        gas_used_usd: gasVal || null,
        raw_profit_usd: rawProfit,
        profit_with_gas_usd: profitWithGas,
        opponent: newTrade.opponent,
        win: newTrade.win,
        api_call_duration_ms: null,
        priority_gwei: null,
        opponent_trades_count: null,
        opponent_time_gap_ms: null,
        trade_logs: [],
      };

      const response = await fetch('/api/trades', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(tradeData),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create trade');
      }

      // Reset form and close modal
      setNewTrade({
        trigger_category: 'onchain',
        trigger_type: 'fast_hook',
        block_number: '',
        trade_amount_rlb: '',
        direction: 'buy_onsite_sell_onchain',
        step1_action: 'buy',
        onsite_value_with_fee: '',
        tx_hash: '',
        onchain_usd_value: '',
        gas_used_usd: '',
        opponent: false,
        win: true,
      });
      setIsAddModalOpen(false);

      // Refresh trades list
      await fetchTrades();
    } catch (err) {
      console.error('Add trade error:', err);
      alert(err instanceof Error ? err.message : 'Failed to add trade');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Paginated trades
  const indexOfLastTrade = currentPage * tradesPerPage;
  const indexOfFirstTrade = indexOfLastTrade - tradesPerPage;
  const currentTrades = trades.slice(indexOfFirstTrade, indexOfLastTrade);
  const totalPages = Math.ceil(trades.length / tradesPerPage);

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Trade Performance</h1>
          <p className="text-sm text-muted-foreground mt-1">Monitor trade execution and outcomes</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex gap-2">
            <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
              <DialogTrigger asChild>
                <Button variant="default" size="sm">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Trade
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                  <DialogTitle>Add Manual Trade</DialogTitle>
                  <DialogDescription>
                    Manually add a trade record. Fill in the details below.
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  {/* Row 1: Category & Type */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="trigger_category">Category</Label>
                      <Select
                        value={newTrade.trigger_category}
                        onValueChange={(v) => setNewTrade({ ...newTrade, trigger_category: v })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="onchain">Onchain</SelectItem>
                          <SelectItem value="onsite">Onsite</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="trigger_type">Trigger Type</Label>
                      <Select
                        value={newTrade.trigger_type}
                        onValueChange={(v) => setNewTrade({ ...newTrade, trigger_type: v })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="fast_hook">Fast Hook</SelectItem>
                          <SelectItem value="rollbit_price_update">Rollbit Price Update</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* Row 2: Direction */}
                  <div className="space-y-2">
                    <Label>Direction</Label>
                    <Select
                      value={newTrade.direction}
                      onValueChange={(v) => setNewTrade({
                        ...newTrade,
                        direction: v,
                        step1_action: v === 'buy_onsite_sell_onchain' ? 'buy' : 'sell'
                      })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="buy_onsite_sell_onchain">Buy Onsite → Sell Onchain</SelectItem>
                        <SelectItem value="sell_onsite_buy_onchain">Sell Onsite → Buy Onchain</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Row 3: Block & Amount */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="block_number">Block Number *</Label>
                      <Input
                        id="block_number"
                        type="number"
                        placeholder="e.g., 21285000"
                        value={newTrade.block_number}
                        onChange={(e) => setNewTrade({ ...newTrade, block_number: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="trade_amount_rlb">Amount (RLB) *</Label>
                      <Input
                        id="trade_amount_rlb"
                        type="number"
                        placeholder="e.g., 40001"
                        value={newTrade.trade_amount_rlb}
                        onChange={(e) => setNewTrade({ ...newTrade, trade_amount_rlb: e.target.value })}
                      />
                    </div>
                  </div>

                  {/* Row 4: USD Values */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="onsite_value_with_fee">Onsite Value (USD)</Label>
                      <Input
                        id="onsite_value_with_fee"
                        type="number"
                        step="0.01"
                        placeholder="e.g., 2200.50"
                        value={newTrade.onsite_value_with_fee}
                        onChange={(e) => setNewTrade({ ...newTrade, onsite_value_with_fee: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="onchain_usd_value">Onchain Value (USD)</Label>
                      <Input
                        id="onchain_usd_value"
                        type="number"
                        step="0.01"
                        placeholder="e.g., 2205.30"
                        value={newTrade.onchain_usd_value}
                        onChange={(e) => setNewTrade({ ...newTrade, onchain_usd_value: e.target.value })}
                      />
                    </div>
                  </div>

                  {/* Row 5: Gas & TX Hash */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="gas_used_usd">Gas (USD)</Label>
                      <Input
                        id="gas_used_usd"
                        type="number"
                        step="0.0001"
                        placeholder="e.g., 0.50"
                        value={newTrade.gas_used_usd}
                        onChange={(e) => setNewTrade({ ...newTrade, gas_used_usd: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="tx_hash">TX Hash</Label>
                      <Input
                        id="tx_hash"
                        placeholder="0x..."
                        value={newTrade.tx_hash}
                        onChange={(e) => setNewTrade({ ...newTrade, tx_hash: e.target.value })}
                      />
                    </div>
                  </div>

                  {/* Row 6: Opponent & Win */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id="opponent"
                        checked={newTrade.opponent}
                        onChange={(e) => setNewTrade({ ...newTrade, opponent: e.target.checked })}
                        className="h-4 w-4 rounded border-gray-300"
                      />
                      <Label htmlFor="opponent">Has Opponent</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id="win"
                        checked={newTrade.win}
                        onChange={(e) => setNewTrade({ ...newTrade, win: e.target.checked })}
                        className="h-4 w-4 rounded border-gray-300"
                      />
                      <Label htmlFor="win">Win</Label>
                    </div>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsAddModalOpen(false)}>
                    Cancel
                  </Button>
                  <Button onClick={handleAddTrade} disabled={isSubmitting}>
                    {isSubmitting ? 'Adding...' : 'Add Trade'}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
            <Button onClick={fetchTrades} variant="outline" size="sm">
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
            <Button
              onClick={handleDeleteAllTrades}
              variant="destructive"
              size="sm"
              disabled={deletingAll || trades.length === 0}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              {deletingAll ? 'Deleting...' : 'Remove All'}
            </Button>
          </div>
        </div>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Compact Statistics */}
      {statistics && (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="text-sm text-muted-foreground">Total Trades</div>
              <div className="text-3xl font-bold mt-1">{statistics.total_trades}</div>
              <div className="flex gap-3 text-xs text-muted-foreground mt-2">
                <span className="font-medium">Onchain: {statistics.by_trigger_category.onchain}</span>
                <span className="font-medium">Onsite: {statistics.by_trigger_category.onsite}</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="text-sm text-muted-foreground">Win Rate</div>
              <div className="text-3xl font-bold mt-1">
                {statistics.win_rate !== null ? `${statistics.win_rate.toFixed(1)}%` : 'N/A'}
              </div>
              <div className="flex gap-3 text-xs mt-2">
                <span className="text-green-600 font-medium">W: {statistics.wins}</span>
                <span className="text-red-600 font-medium">L: {statistics.losses}</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="text-sm text-muted-foreground">Win Amount</div>
              <div className="text-3xl font-bold mt-1 text-green-600">
                {statistics.avg_win_amount !== null ? formatNumber(Math.round(statistics.avg_win_amount)) : 'N/A'}
              </div>
              <div className="text-xs text-muted-foreground mt-2">
                Min: {statistics.min_win_amount !== null ? formatNumber(statistics.min_win_amount) : 'N/A'} | Max: {statistics.max_win_amount !== null ? formatNumber(statistics.max_win_amount) : 'N/A'}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="text-sm text-muted-foreground">Loss Amount</div>
              <div className="text-3xl font-bold mt-1 text-red-600">
                {statistics.avg_loss_amount !== null ? formatNumber(Math.round(statistics.avg_loss_amount)) : 'N/A'}
              </div>
              <div className="text-xs text-muted-foreground mt-2">
                Min: {statistics.min_loss_amount !== null ? formatNumber(statistics.min_loss_amount) : 'N/A'} | Max: {statistics.max_loss_amount !== null ? formatNumber(statistics.max_loss_amount) : 'N/A'}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="text-sm text-muted-foreground">Win Time Gap</div>
              <div className="text-3xl font-bold mt-1 text-green-600">
                {statistics.avg_win_time_gap_ms !== null ? `${statistics.avg_win_time_gap_ms.toFixed(2)}ms` : 'N/A'}
              </div>
              <div className="text-xs text-muted-foreground mt-2">
                {statistics.min_win_time_gap_ms !== null ? `${statistics.min_win_time_gap_ms.toFixed(2)}ms` : 'N/A'} - {statistics.max_win_time_gap_ms !== null ? `${statistics.max_win_time_gap_ms.toFixed(2)}ms` : 'N/A'}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="text-sm text-muted-foreground">Loss Time Gap</div>
              <div className="text-3xl font-bold mt-1 text-red-600">
                {statistics.avg_loss_time_gap_ms !== null ? `${statistics.avg_loss_time_gap_ms.toFixed(2)}ms` : 'N/A'}
              </div>
              <div className="text-xs text-muted-foreground mt-2">
                {statistics.min_loss_time_gap_ms !== null ? `${statistics.min_loss_time_gap_ms.toFixed(2)}ms` : 'N/A'} - {statistics.max_loss_time_gap_ms !== null ? `${statistics.max_loss_time_gap_ms.toFixed(2)}ms` : 'N/A'}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="text-sm text-muted-foreground">Response Time</div>
              <div className="text-3xl font-bold mt-1">
                {formatDuration(statistics.avg_api_duration_ms)}
              </div>
              <div className="text-xs text-muted-foreground mt-2">
                {formatDuration(statistics.min_api_duration_ms)} - {formatDuration(statistics.max_api_duration_ms)}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="text-sm text-muted-foreground">Total Volume</div>
              <div className="text-3xl font-bold mt-1">
                {formatNumber(Math.round(statistics.total_volume_rlb))}
              </div>
              <div className="text-xs mt-2">
                <span className="text-green-600 font-medium">W: {formatNumber(Math.round(statistics.total_win_volume))}</span>
                <span className="text-muted-foreground mx-1">|</span>
                <span className="text-red-600 font-medium">L: {formatNumber(Math.round(statistics.total_loss_volume))}</span>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filters with Tabs */}
      <Tabs defaultValue="all" value={triggerCategory} onValueChange={setTriggerCategory}>
        <div className="flex items-center justify-between">
          <TabsList>
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="onchain">Onchain</TabsTrigger>
            <TabsTrigger value="onsite">Onsite</TabsTrigger>
          </TabsList>

          <div className="flex gap-2">
            <Select value={opponentFilter} onValueChange={setOpponentFilter}>
              <SelectTrigger className="w-[140px] h-9">
                <SelectValue placeholder="Opponent" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="true">Has Opponent</SelectItem>
                <SelectItem value="false">Solo</SelectItem>
              </SelectContent>
            </Select>

            <Select value={winFilter} onValueChange={setWinFilter}>
              <SelectTrigger className="w-[140px] h-9">
                <SelectValue placeholder="Result" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="true">Wins</SelectItem>
                <SelectItem value="false">Losses</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </Tabs>

      {/* Trades Table */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Recent Trades</CardTitle>
              <CardDescription className="mt-1">
                {trades.length} total trades {currentTrades.length > 0 && `(showing ${indexOfFirstTrade + 1}-${Math.min(indexOfLastTrade, trades.length)})`}
              </CardDescription>
            </div>
            {totalPages > 1 && (
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                >
                  Previous
                </Button>
                <span className="text-sm text-muted-foreground">
                  {currentPage} / {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                >
                  Next
                </Button>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-12 text-muted-foreground">Loading trades...</div>
          ) : currentTrades.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">No trades found</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[130px]">Time</TableHead>
                  <TableHead>Trade</TableHead>
                  <TableHead className="text-right">Onsite</TableHead>
                  <TableHead className="text-center">Onchain</TableHead>
                  <TableHead className="text-right">Gas $</TableHead>
                  <TableHead className="text-right">Profit</TableHead>
                  <TableHead className="text-center">Block</TableHead>
                  <TableHead className="text-center">Relay vs Bloxroute</TableHead>
                  <TableHead className="text-right">Response</TableHead>
                  <TableHead className="text-center">Result</TableHead>
                  <TableHead className="w-[80px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {currentTrades.map((trade) => (
                  <TableRow
                    key={trade.id}
                    className={`group cursor-pointer hover:bg-muted/50 ${
                      trade.trigger_category === 'onchain'
                        ? 'bg-blue-50/50 dark:bg-blue-950/20'
                        : 'bg-amber-50/50 dark:bg-amber-950/20'
                    }`}
                    onClick={() => router.push(`/trades/${trade.trade_id || trade.id}`)}
                  >
                    <TableCell className="font-mono text-xs" title={new Date(trade.timestamp).toLocaleString()}>
                      {formatRelativeTime(trade.timestamp)}
                    </TableCell>
                    {/* Consolidated Trade column: trigger + direction + amount */}
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {getDirectionIcon(trade.direction)}
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${
                              trade.trigger_category === 'onchain'
                                ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300'
                                : 'bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300'
                            }`}>
                              {trade.trigger_category === 'onchain' ? '⛓️ CHAIN' : '🏠 SITE'}
                            </span>
                            <span className="font-bold">{formatNumber(trade.trade_amount_rlb)}</span>
                            <span className="text-xs text-muted-foreground">RLB</span>
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {trade.step1_action === 'buy' ? 'Buy' : 'Sell'} Onsite → {trade.step1_action === 'buy' ? 'Sell' : 'Buy'} Onchain
                          </div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      {trade.onsite_value_with_fee !== null ? (
                        <div className="font-medium">{formatUSD(trade.onsite_value_with_fee)}</div>
                      ) : trade.step1_usd_value !== null ? (
                        <div>
                          <div className="font-medium">{formatUSD(trade.step1_usd_value)}</div>
                          <div className="text-xs text-muted-foreground">(no fee)</div>
                        </div>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      {trade.onchain_usd_value !== null ? (
                        <div className="font-medium">{formatUSD(trade.onchain_usd_value)}</div>
                      ) : trade.tx_hash ? (
                        <div
                          className="flex items-center justify-center gap-1 text-blue-500 hover:text-blue-700"
                          onClick={(e) => {
                            e.stopPropagation();
                            window.open(`https://etherscan.io/tx/${trade.tx_hash}`, '_blank');
                          }}
                        >
                          <span className="font-mono text-xs">{shortenHash(trade.tx_hash)}</span>
                          <ExternalLink className="h-3 w-3" />
                        </div>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    {/* Gas Fee $ */}
                    <TableCell className="text-right">
                      {trade.gas_used_usd !== null ? (
                        <span className="text-xs font-mono text-orange-600">{formatUSD(trade.gas_used_usd)}</span>
                      ) : (
                        <span className="text-muted-foreground text-xs">-</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {trade.profit_with_gas_usd !== null ? (
                        <div className={`font-bold ${trade.profit_with_gas_usd >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {formatUSD(trade.profit_with_gas_usd)}
                        </div>
                      ) : trade.raw_profit_usd !== null ? (
                        <div className={`font-medium ${trade.raw_profit_usd >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {formatUSD(trade.raw_profit_usd)}
                          <div className="text-xs text-muted-foreground">(no gas)</div>
                        </div>
                      ) : (
                        <span className="text-muted-foreground text-xs">Pending</span>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="font-mono text-xs">#{trade.block_number}</div>
                      {trade.slot_number && (
                        <div className="font-mono text-xs text-muted-foreground">slot {trade.slot_number}</div>
                      )}
                    </TableCell>
                    {/* Consolidated Relay vs Bloxroute */}
                    <TableCell className="text-center">
                      {trade.first_relay || trade.bloxroute_origin ? (
                        <div className="flex flex-col items-center gap-1">
                          {/* Relay info */}
                          <div className="text-xs">
                            <span className="text-green-700 font-medium">{trade.first_relay || '-'}</span>
                          </div>
                          {/* Bloxroute comparison */}
                          {trade.bloxroute_comparison.is_win_relay !== null ? (
                            <div className="flex items-center gap-1">
                              <span className={`text-xs font-bold ${trade.bloxroute_comparison.is_win_relay ? 'text-green-600' : 'text-red-600'}`}>
                                {trade.bloxroute_comparison.is_win_relay ? '🏆' : '⚡'}
                              </span>
                              <span className={`text-xs font-mono ${trade.bloxroute_comparison.time_diff_ms! < 0 ? 'text-green-600' : 'text-red-600'}`}>
                                {trade.bloxroute_comparison.time_diff_ms! < 0 ? '' : '+'}{trade.bloxroute_comparison.time_diff_ms}ms
                              </span>
                            </div>
                          ) : (
                            <span className="text-muted-foreground text-xs">vs {trade.bloxroute_origin || 'N/A'}</span>
                          )}
                        </div>
                      ) : (
                        <span className="text-muted-foreground text-xs">N/A</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Clock className="h-3 w-3 text-muted-foreground" />
                        <span className="text-xs">{formatDuration(trade.api_call_duration_ms)}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      {(trade.win === true || !trade.opponent) && (
                        <div className="flex flex-col items-center gap-0.5">
                          <div className="flex items-center gap-1 text-green-600">
                            <CheckCircle2 className="h-4 w-4" />
                            <span className="text-xs font-medium">{!trade.opponent ? 'Solo' : 'Win'}</span>
                          </div>
                          {trade.opponent && trade.opponent_time_gap_ms !== null && (
                            <span className="text-xs font-mono text-green-600">
                              +{trade.opponent_time_gap_ms.toFixed(1)}ms
                            </span>
                          )}
                        </div>
                      )}
                      {trade.win === false && trade.opponent && (
                        <div className="flex flex-col items-center gap-0.5">
                          <div className="flex items-center gap-1 text-red-600">
                            <XCircle className="h-4 w-4" />
                            <span className="text-xs font-medium">Loss</span>
                          </div>
                          {trade.opponent_time_gap_ms !== null && (
                            <span className="text-xs font-mono text-red-600">
                              -{Math.abs(trade.opponent_time_gap_ms).toFixed(1)}ms
                            </span>
                          )}
                        </div>
                      )}
                      {trade.win === null && trade.opponent && (
                        <div className="flex items-center justify-center gap-1 text-muted-foreground">
                          <MinusCircle className="h-4 w-4" />
                          <span className="text-xs">Pending</span>
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={(e) => {
                            e.stopPropagation();
                            router.push(`/trades/${trade.trade_id || trade.id}`);
                          }}
                          className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                          title="View details"
                        >
                          <ExternalLink className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteTrade(trade.id);
                          }}
                          disabled={deletingTrade === trade.id}
                          className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity text-red-500 hover:text-red-700 hover:bg-red-50"
                          title="Delete trade"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}