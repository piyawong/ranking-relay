'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Save, ExternalLink, RefreshCw, Calculator } from 'lucide-react';
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Trade {
  id: string;
  trade_id: string | null;
  trade_number: number | null;
  timestamp: string;
  trigger_category: string;
  trigger_type: string;
  block_number: number;
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
  created_at: string;
  updated_at: string;
}

export default function TradeDetailPage() {
  const params = useParams();
  const tradeId = params.tradeId as string;
  const router = useRouter();
  const [trade, setTrade] = useState<Trade | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Editable fields
  const [formData, setFormData] = useState({
    onchain_usd_value: '',
    gas_used_usd: '',
    raw_profit_usd: '',
    profit_with_gas_usd: '',
    api_call_duration_ms: '',
    priority_gwei: '',
    opponent_time_gap_ms: '',
    opponent_trades_count: '',
    tx_hash: '',
    onsite_value_with_fee: '',
    direction: '',
    win: '',
    opponent: '',
  });

  useEffect(() => {
    fetchTrade();
  }, [tradeId]);

  const fetchTrade = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch(`/api/trades/${tradeId}`);
      if (!response.ok) {
        if (response.status === 404) {
          throw new Error('Trade not found');
        }
        throw new Error('Failed to fetch trade');
      }
      const data = await response.json();
      setTrade(data.trade);

      // Initialize form with existing values
      setFormData({
        onchain_usd_value: data.trade.onchain_usd_value?.toString() || '',
        gas_used_usd: data.trade.gas_used_usd?.toString() || '',
        raw_profit_usd: data.trade.raw_profit_usd?.toString() || '',
        profit_with_gas_usd: data.trade.profit_with_gas_usd?.toString() || '',
        api_call_duration_ms: data.trade.api_call_duration_ms?.toString() || '',
        priority_gwei: data.trade.priority_gwei?.toString() || '',
        opponent_time_gap_ms: data.trade.opponent_time_gap_ms?.toString() || '',
        opponent_trades_count: data.trade.opponent_trades_count?.toString() || '',
        tx_hash: data.trade.tx_hash || '',
        onsite_value_with_fee: data.trade.onsite_value_with_fee?.toString() || '',
        direction: data.trade.direction || '',
        win: data.trade.win === null ? '' : data.trade.win ? 'true' : 'false',
        opponent: data.trade.opponent ? 'true' : 'false',
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const calculateProfits = () => {
    if (!trade) return;

    const onsiteValue = trade.onsite_value_with_fee;
    const onchainValue = parseFloat(formData.onchain_usd_value) || null;
    const gasUsed = parseFloat(formData.gas_used_usd) || null;

    if (onsiteValue !== null && onchainValue !== null && trade.direction) {
      let rawProfit: number;

      if (trade.direction === 'buy_onsite_sell_onchain') {
        // Buy onsite (cost), sell onchain (revenue)
        rawProfit = onchainValue - onsiteValue;
      } else {
        // Sell onsite (revenue), buy onchain (cost)
        rawProfit = onsiteValue - onchainValue;
      }

      setFormData(prev => ({
        ...prev,
        raw_profit_usd: rawProfit.toFixed(2),
        profit_with_gas_usd: gasUsed !== null ? (rawProfit - gasUsed).toFixed(2) : '',
      }));
    }
  };

  const handleSave = async () => {
    if (!trade) return;

    try {
      setSaving(true);
      setError(null);
      setSuccess(null);

      const updateData: Record<string, unknown> = {};

      // Numeric fields
      if (formData.onchain_usd_value) {
        updateData.onchain_usd_value = parseFloat(formData.onchain_usd_value);
      }
      if (formData.gas_used_usd) {
        updateData.gas_used_usd = parseFloat(formData.gas_used_usd);
      }
      if (formData.raw_profit_usd) {
        updateData.raw_profit_usd = parseFloat(formData.raw_profit_usd);
      }
      if (formData.profit_with_gas_usd) {
        updateData.profit_with_gas_usd = parseFloat(formData.profit_with_gas_usd);
      }
      if (formData.api_call_duration_ms) {
        updateData.api_call_duration_ms = parseFloat(formData.api_call_duration_ms);
      }
      if (formData.priority_gwei) {
        updateData.priority_gwei = parseFloat(formData.priority_gwei);
      }
      if (formData.opponent_time_gap_ms) {
        updateData.opponent_time_gap_ms = parseFloat(formData.opponent_time_gap_ms);
      }
      if (formData.opponent_trades_count) {
        updateData.opponent_trades_count = parseInt(formData.opponent_trades_count);
      }
      if (formData.onsite_value_with_fee) {
        updateData.onsite_value_with_fee = parseFloat(formData.onsite_value_with_fee);
      }

      // String fields
      if (formData.tx_hash !== trade.tx_hash) {
        updateData.tx_hash = formData.tx_hash || null;
      }
      if (formData.direction !== (trade.direction || '')) {
        updateData.direction = formData.direction || null;
      }

      // Boolean fields
      if (formData.win !== '') {
        updateData.win = formData.win === 'true';
      }
      if (formData.opponent !== '') {
        updateData.opponent = formData.opponent === 'true';
      }

      const response = await fetch(`/api/trades/${trade.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateData),
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Failed to update trade');
      }

      const data = await response.json();
      setTrade(data.trade);
      setSuccess('Trade updated successfully');

      // Update form with returned values
      setFormData({
        onchain_usd_value: data.trade.onchain_usd_value?.toString() || '',
        gas_used_usd: data.trade.gas_used_usd?.toString() || '',
        raw_profit_usd: data.trade.raw_profit_usd?.toString() || '',
        profit_with_gas_usd: data.trade.profit_with_gas_usd?.toString() || '',
        api_call_duration_ms: data.trade.api_call_duration_ms?.toString() || '',
        priority_gwei: data.trade.priority_gwei?.toString() || '',
        opponent_time_gap_ms: data.trade.opponent_time_gap_ms?.toString() || '',
        opponent_trades_count: data.trade.opponent_trades_count?.toString() || '',
        tx_hash: data.trade.tx_hash || '',
        onsite_value_with_fee: data.trade.onsite_value_with_fee?.toString() || '',
        direction: data.trade.direction || '',
        win: data.trade.win === null ? '' : data.trade.win ? 'true' : 'false',
        opponent: data.trade.opponent ? 'true' : 'false',
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const formatUSD = (value: number | null) => {
    if (value === null) return '-';
    return `$${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat('en-US').format(num);
  };

  const getDirectionBadge = (direction: string | null) => {
    if (!direction) return <Badge variant="outline">Unknown</Badge>;
    if (direction === 'buy_onsite_sell_onchain') {
      return <Badge className="bg-green-600">Buy Onsite → Sell Onchain</Badge>;
    }
    return <Badge className="bg-blue-600">Sell Onsite → Buy Onchain</Badge>;
  };

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <div className="text-center py-12 text-muted-foreground">Loading trade...</div>
      </div>
    );
  }

  if (error && !trade) {
    return (
      <div className="container mx-auto p-6">
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
        <Button onClick={() => router.push('/trades')} variant="outline" className="mt-4">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Trades
        </Button>
      </div>
    );
  }

  if (!trade) return null;

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button onClick={() => router.push('/trades')} variant="outline" size="sm">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Trade Details</h1>
            <p className="text-sm text-muted-foreground">
              ID: {trade.trade_id || trade.id}
            </p>
          </div>
        </div>
        <Button onClick={fetchTrade} variant="outline" size="sm">
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {success && (
        <Alert className="border-green-500 bg-green-50">
          <AlertDescription className="text-green-700">{success}</AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Trade Info Card */}
        <Card>
          <CardHeader>
            <CardTitle>Trade Information</CardTitle>
            <CardDescription>Basic trade details</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-muted-foreground text-xs">Timestamp</Label>
                <p className="font-mono text-sm">
                  {new Date(trade.timestamp).toLocaleString()}
                </p>
              </div>
              <div>
                <Label className="text-muted-foreground text-xs">Block Number</Label>
                <p className="font-mono text-sm">#{trade.block_number}</p>
              </div>
              <div>
                <Label className="text-muted-foreground text-xs">Trigger</Label>
                <div className="flex gap-2 mt-1">
                  <Badge variant="outline">{trade.trigger_category}</Badge>
                  <Badge variant="outline">{trade.trigger_type}</Badge>
                </div>
              </div>
              <div>
                <Label className="text-muted-foreground text-xs">Direction</Label>
                <div className="mt-1">
                  {getDirectionBadge(trade.direction)}
                </div>
              </div>
              <div>
                <Label className="text-muted-foreground text-xs">Trade Amount</Label>
                <p className="font-medium">{formatNumber(trade.trade_amount_rlb)} RLB</p>
              </div>
              <div>
                <Label className="text-muted-foreground text-xs">Step 1 Action</Label>
                <Badge className={trade.step1_action === 'buy' ? 'bg-green-500' : 'bg-red-500'}>
                  {trade.step1_action || '-'}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Onsite Values Card */}
        <Card>
          <CardHeader>
            <CardTitle>Onsite Values (Step 1)</CardTitle>
            <CardDescription>Values from the onsite trade - editable</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-muted-foreground text-xs">Step 1 USD Value</Label>
                <p className="font-medium text-lg">{formatUSD(trade.step1_usd_value)}</p>
              </div>
              <div>
                <Label className="text-muted-foreground text-xs">Onsite Value USD</Label>
                <p className="font-medium text-lg">{formatUSD(trade.onsite_value_usd)}</p>
              </div>
              <div className="col-span-2">
                <Label htmlFor="onsite_value_with_fee">Onsite Value With Fee (USD)</Label>
                <Input
                  id="onsite_value_with_fee"
                  type="number"
                  step="0.01"
                  placeholder="Enter onsite value with fee"
                  value={formData.onsite_value_with_fee}
                  onChange={(e) => setFormData(prev => ({ ...prev, onsite_value_with_fee: e.target.value }))}
                  className="mt-1"
                />
                <p className="text-xs text-muted-foreground mt-1">This is used for profit calculation</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Onchain Values Card (Editable) */}
        <Card>
          <CardHeader>
            <CardTitle>Onchain Values (Step 2)</CardTitle>
            <CardDescription>Values from the onchain transaction - editable</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="tx_hash">Transaction Hash</Label>
              <div className="flex items-center gap-2 mt-1">
                <Input
                  id="tx_hash"
                  type="text"
                  placeholder="0x..."
                  value={formData.tx_hash}
                  onChange={(e) => setFormData(prev => ({ ...prev, tx_hash: e.target.value }))}
                  className="font-mono text-xs flex-1"
                />
                {formData.tx_hash && (
                  <a
                    href={`https://etherscan.io/tx/${formData.tx_hash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-500 hover:text-blue-700"
                  >
                    <ExternalLink className="h-4 w-4" />
                  </a>
                )}
              </div>
            </div>

            <div>
              <Label htmlFor="onchain_usd_value">Onchain USD Value</Label>
              <Input
                id="onchain_usd_value"
                type="number"
                step="0.01"
                placeholder="Enter onchain USD value"
                value={formData.onchain_usd_value}
                onChange={(e) => setFormData(prev => ({ ...prev, onchain_usd_value: e.target.value }))}
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="gas_used_usd">Gas Used (USD)</Label>
              <Input
                id="gas_used_usd"
                type="number"
                step="0.0001"
                placeholder="Enter gas cost in USD"
                value={formData.gas_used_usd}
                onChange={(e) => setFormData(prev => ({ ...prev, gas_used_usd: e.target.value }))}
                className="mt-1"
              />
            </div>
          </CardContent>
        </Card>

        {/* Profit Calculation Card */}
        <Card>
          <CardHeader>
            <CardTitle>Profit Calculation</CardTitle>
            <CardDescription>
              Formula: {trade.direction === 'buy_onsite_sell_onchain'
                ? 'Onchain (sell) - Onsite (buy)'
                : 'Onsite (sell) - Onchain (buy)'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button onClick={calculateProfits} variant="outline" className="w-full">
              <Calculator className="h-4 w-4 mr-2" />
              Auto-Calculate Profits
            </Button>

            <div>
              <Label htmlFor="raw_profit_usd">Raw Profit (USD)</Label>
              <Input
                id="raw_profit_usd"
                type="number"
                step="0.01"
                placeholder="sell_side - buy_side"
                value={formData.raw_profit_usd}
                onChange={(e) => setFormData(prev => ({ ...prev, raw_profit_usd: e.target.value }))}
                className="mt-1"
              />
              <p className="text-xs text-muted-foreground mt-1">sell_side - buy_side</p>
            </div>

            <div>
              <Label htmlFor="profit_with_gas_usd">Profit With Gas (USD)</Label>
              <Input
                id="profit_with_gas_usd"
                type="number"
                step="0.01"
                placeholder="raw_profit - gas"
                value={formData.profit_with_gas_usd}
                onChange={(e) => setFormData(prev => ({ ...prev, profit_with_gas_usd: e.target.value }))}
                className="mt-1"
              />
              <p className="text-xs text-muted-foreground mt-1">raw_profit - gas_used</p>
            </div>

            {/* Current saved values */}
            <div className="pt-4 border-t">
              <p className="text-xs text-muted-foreground mb-2">Current Saved Values:</p>
              <div className="grid grid-cols-2 gap-2">
                <div className={`p-2 rounded ${trade.raw_profit_usd !== null && trade.raw_profit_usd >= 0 ? 'bg-green-50' : 'bg-red-50'}`}>
                  <p className="text-xs text-muted-foreground">Raw Profit</p>
                  <p className={`font-bold ${trade.raw_profit_usd !== null && trade.raw_profit_usd >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {formatUSD(trade.raw_profit_usd)}
                  </p>
                </div>
                <div className={`p-2 rounded ${trade.profit_with_gas_usd !== null && trade.profit_with_gas_usd >= 0 ? 'bg-green-50' : 'bg-red-50'}`}>
                  <p className="text-xs text-muted-foreground">With Gas</p>
                  <p className={`font-bold ${trade.profit_with_gas_usd !== null && trade.profit_with_gas_usd >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {formatUSD(trade.profit_with_gas_usd)}
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Save Button */}
      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving} size="lg">
          <Save className="h-4 w-4 mr-2" />
          {saving ? 'Saving...' : 'Save Changes'}
        </Button>
      </div>

      {/* Performance & Timing Card (Editable) */}
      <Card>
        <CardHeader>
          <CardTitle>Performance & Timing</CardTitle>
          <CardDescription>Response time and execution details - editable</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <Label htmlFor="api_call_duration_ms">API Response Time (ms)</Label>
              <Input
                id="api_call_duration_ms"
                type="number"
                step="0.01"
                placeholder="Response time in ms"
                value={formData.api_call_duration_ms}
                onChange={(e) => setFormData(prev => ({ ...prev, api_call_duration_ms: e.target.value }))}
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="priority_gwei">Priority (Gwei)</Label>
              <Input
                id="priority_gwei"
                type="number"
                step="0.001"
                placeholder="Gas priority in Gwei"
                value={formData.priority_gwei}
                onChange={(e) => setFormData(prev => ({ ...prev, priority_gwei: e.target.value }))}
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="opponent_time_gap_ms">Opponent Time Gap (ms)</Label>
              <Input
                id="opponent_time_gap_ms"
                type="number"
                step="0.01"
                placeholder="Time gap in ms"
                value={formData.opponent_time_gap_ms}
                onChange={(e) => setFormData(prev => ({ ...prev, opponent_time_gap_ms: e.target.value }))}
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="opponent_trades_count">Opponent Trades Count</Label>
              <Input
                id="opponent_trades_count"
                type="number"
                step="1"
                placeholder="Number of opponent trades"
                value={formData.opponent_trades_count}
                onChange={(e) => setFormData(prev => ({ ...prev, opponent_trades_count: e.target.value }))}
                className="mt-1"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Trade Status Card (Editable) */}
      <Card>
        <CardHeader>
          <CardTitle>Trade Status</CardTitle>
          <CardDescription>Win/loss status and opponent detection</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <Label>Win Status</Label>
              <Select
                value={formData.win || "pending"}
                onValueChange={(value) => setFormData(prev => ({ ...prev, win: value === "pending" ? "" : value }))}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="true">Won</SelectItem>
                  <SelectItem value="false">Lost</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Opponent Detected</Label>
              <Select
                value={formData.opponent}
                onValueChange={(value) => setFormData(prev => ({ ...prev, opponent: value }))}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Select" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="true">Yes</SelectItem>
                  <SelectItem value="false">No</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Direction</Label>
              <Select
                value={formData.direction || "unknown"}
                onValueChange={(value) => setFormData(prev => ({ ...prev, direction: value === "unknown" ? "" : value }))}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Select direction" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="unknown">Unknown</SelectItem>
                  <SelectItem value="buy_onsite_sell_onchain">Buy Onsite → Sell Onchain</SelectItem>
                  <SelectItem value="sell_onsite_buy_onchain">Sell Onsite → Buy Onchain</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-muted-foreground text-xs">Updated At</Label>
              <p className="font-mono text-sm mt-2">{new Date(trade.updated_at).toLocaleString()}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Read-Only Info Card */}
      <Card>
        <CardHeader>
          <CardTitle>Read-Only Information</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <Label className="text-muted-foreground text-xs">Initial Reserves</Label>
              <p className="font-mono text-sm">{formatNumber(trade.initial_reserves_rlb)} RLB</p>
            </div>
            <div>
              <Label className="text-muted-foreground text-xs">Trade Amount</Label>
              <p className="font-mono text-sm">{formatNumber(trade.trade_amount_rlb)} RLB</p>
            </div>
            <div>
              <Label className="text-muted-foreground text-xs">Block Number</Label>
              <p className="font-mono text-sm">#{trade.block_number}</p>
            </div>
            <div>
              <Label className="text-muted-foreground text-xs">Created At</Label>
              <p className="font-mono text-sm">{new Date(trade.created_at).toLocaleString()}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
