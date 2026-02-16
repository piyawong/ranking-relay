'use client';

import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
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
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  Download,
  FileSpreadsheet,
  Filter,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  MapPin,
  AlertCircle,
  CheckCircle2,
  Search,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface ReportRecord {
  block_number: number;
  block_hash: string | null;
  block_created_at: string;
  bloxroute_timestamp: string | null;
  bloxroute_origin: string | null;
  relay_name: string;
  arrival_order: number;
  latency: number;
  loss: number;
  arrival_timestamp: string | null;
  ranking_score: number;
  node_id: string | null;
  node_tag: string | null;
  node_latitude: number | null;
  node_longitude: number | null;
  node_location: string | null;
  node_country: string | null;
  node_status: string | null;
  node_endpoint: string | null;
  is_mapped: boolean;
}

interface ReportSummary {
  totalBlocks: number;
  totalRecords: number;
  mappedRecords: number;
  unmappedRecords: number;
  uniqueRelays: number;
  filters: {
    startDate: string | null;
    endDate: string | null;
    startBlock: number | null;
    endBlock: number | null;
    relayNames: string[] | null;
  };
}

interface ReportResponse {
  success: boolean;
  data?: {
    report: ReportRecord[];
    summary: ReportSummary;
  };
  error?: string;
}

// Fetch unique relay names
async function fetchRelayNames(): Promise<string[]> {
  const res = await fetch('/api/relays?uniqueNames=true');
  if (!res.ok) throw new Error('Failed to fetch relay names');
  const data = await res.json();
  return data.data?.relayNames || [];
}

// Fetch report data
async function fetchReport(params: URLSearchParams): Promise<ReportResponse> {
  const res = await fetch(`/api/report?${params.toString()}`);
  if (!res.ok) throw new Error('Failed to fetch report');
  return res.json();
}

// Format date for display
function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

// Format date for input
function formatDateForInput(date: Date): string {
  return date.toISOString().split('T')[0];
}

export default function ReportPage() {
  // Filter states
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [startBlock, setStartBlock] = useState('');
  const [endBlock, setEndBlock] = useState('');
  const [selectedRelays, setSelectedRelays] = useState<string[]>([]);
  const [limit, setLimit] = useState('1000');
  const [showMappedOnly, setShowMappedOnly] = useState(false);

  // UI states
  const [filtersExpanded, setFiltersExpanded] = useState(true);
  const [relaySearchQuery, setRelaySearchQuery] = useState('');
  const [isDownloading, setIsDownloading] = useState(false);

  // Fetch relay names for filter
  const { data: relayNames = [], isLoading: relayNamesLoading } = useQuery({
    queryKey: ['relay-names'],
    queryFn: fetchRelayNames,
  });

  // Build query params
  const queryParams = useMemo(() => {
    const params = new URLSearchParams();
    if (startDate) params.set('startDate', startDate);
    if (endDate) params.set('endDate', endDate);
    if (startBlock) params.set('startBlock', startBlock);
    if (endBlock) params.set('endBlock', endBlock);
    if (selectedRelays.length > 0) params.set('relayNames', selectedRelays.join(','));
    params.set('limit', limit);
    return params;
  }, [startDate, endDate, startBlock, endBlock, selectedRelays, limit]);

  // Fetch report
  const {
    data: reportData,
    isLoading: reportLoading,
    refetch: refetchReport,
    isFetching,
  } = useQuery({
    queryKey: ['report', queryParams.toString()],
    queryFn: () => fetchReport(queryParams),
    enabled: false, // Don't auto-fetch, require user to click generate
  });

  // Filter relay names by search query
  const filteredRelayNames = useMemo(() => {
    if (!relaySearchQuery) return relayNames;
    const query = relaySearchQuery.toLowerCase();
    return relayNames.filter(name => name.toLowerCase().includes(query));
  }, [relayNames, relaySearchQuery]);

  // Filter report data if showMappedOnly is true
  const displayedReport = useMemo(() => {
    if (!reportData?.data?.report) return [];
    if (showMappedOnly) {
      return reportData.data.report.filter(r => r.is_mapped);
    }
    return reportData.data.report;
  }, [reportData, showMappedOnly]);

  // Toggle relay selection
  const toggleRelay = (relayName: string) => {
    setSelectedRelays(prev =>
      prev.includes(relayName)
        ? prev.filter(r => r !== relayName)
        : [...prev, relayName]
    );
  };

  // Select all visible relays
  const selectAllRelays = () => {
    setSelectedRelays(filteredRelayNames);
  };

  // Clear all selected relays
  const clearAllRelays = () => {
    setSelectedRelays([]);
  };

  // Generate report
  const handleGenerateReport = () => {
    refetchReport();
  };

  // Download CSV
  const handleDownloadCSV = async () => {
    setIsDownloading(true);
    try {
      const params = new URLSearchParams(queryParams);
      params.set('format', 'csv');

      const res = await fetch(`/api/report?${params.toString()}`);
      if (!res.ok) throw new Error('Download failed');

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `relay-report-${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Download error:', error);
      alert('Failed to download CSV');
    } finally {
      setIsDownloading(false);
    }
  };

  // Quick date presets
  const setDatePreset = (preset: 'today' | 'yesterday' | 'week' | 'month') => {
    const today = new Date();
    const startOfDay = new Date(today);
    startOfDay.setHours(0, 0, 0, 0);

    switch (preset) {
      case 'today':
        setStartDate(formatDateForInput(startOfDay));
        setEndDate(formatDateForInput(today));
        break;
      case 'yesterday': {
        const yesterday = new Date(startOfDay);
        yesterday.setDate(yesterday.getDate() - 1);
        setStartDate(formatDateForInput(yesterday));
        setEndDate(formatDateForInput(yesterday));
        break;
      }
      case 'week': {
        const weekAgo = new Date(startOfDay);
        weekAgo.setDate(weekAgo.getDate() - 7);
        setStartDate(formatDateForInput(weekAgo));
        setEndDate(formatDateForInput(today));
        break;
      }
      case 'month': {
        const monthAgo = new Date(startOfDay);
        monthAgo.setMonth(monthAgo.getMonth() - 1);
        setStartDate(formatDateForInput(monthAgo));
        setEndDate(formatDateForInput(today));
        break;
      }
    }
  };

  const summary = reportData?.data?.summary;
  const loading = reportLoading || isFetching;

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <FileSpreadsheet className="h-8 w-8" />
            Report Generator
          </h1>
          <p className="text-muted-foreground mt-1">
            Generate and download block history reports with relay node data
          </p>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <Collapsible open={filtersExpanded} onOpenChange={setFiltersExpanded}>
          <CardHeader className="pb-3">
            <CollapsibleTrigger className="flex items-center justify-between w-full">
              <div className="flex items-center gap-2">
                <Filter className="h-5 w-5" />
                <CardTitle>Filters</CardTitle>
              </div>
              {filtersExpanded ? (
                <ChevronUp className="h-5 w-5" />
              ) : (
                <ChevronDown className="h-5 w-5" />
              )}
            </CollapsibleTrigger>
          </CardHeader>
          <CollapsibleContent>
            <CardContent className="space-y-6">
              {/* Date Range */}
              <div className="space-y-3">
                <Label className="text-sm font-medium">Date Range</Label>
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setDatePreset('today')}
                  >
                    Today
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setDatePreset('yesterday')}
                  >
                    Yesterday
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setDatePreset('week')}
                  >
                    Last 7 days
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setDatePreset('month')}
                  >
                    Last 30 days
                  </Button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="startDate" className="text-xs text-muted-foreground">
                      Start Date
                    </Label>
                    <Input
                      id="startDate"
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="endDate" className="text-xs text-muted-foreground">
                      End Date
                    </Label>
                    <Input
                      id="endDate"
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                    />
                  </div>
                </div>
              </div>

              {/* Block Range */}
              <div className="space-y-3">
                <Label className="text-sm font-medium">Block Range</Label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="startBlock" className="text-xs text-muted-foreground">
                      Start Block
                    </Label>
                    <Input
                      id="startBlock"
                      type="number"
                      placeholder="e.g., 10000000"
                      value={startBlock}
                      onChange={(e) => setStartBlock(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="endBlock" className="text-xs text-muted-foreground">
                      End Block
                    </Label>
                    <Input
                      id="endBlock"
                      type="number"
                      placeholder="e.g., 10001000"
                      value={endBlock}
                      onChange={(e) => setEndBlock(e.target.value)}
                    />
                  </div>
                </div>
              </div>

              {/* Relay Filter */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-medium">
                    Relays ({selectedRelays.length} selected)
                  </Label>
                  <div className="flex gap-2">
                    <Button variant="ghost" size="sm" onClick={selectAllRelays}>
                      Select All
                    </Button>
                    <Button variant="ghost" size="sm" onClick={clearAllRelays}>
                      Clear All
                    </Button>
                  </div>
                </div>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search relays..."
                    value={relaySearchQuery}
                    onChange={(e) => setRelaySearchQuery(e.target.value)}
                    className="pl-9"
                  />
                </div>
                <div className="border rounded-md p-3 max-h-48 overflow-y-auto">
                  {relayNamesLoading ? (
                    <div className="text-center text-muted-foreground py-4">
                      <RefreshCw className="h-4 w-4 animate-spin mx-auto mb-2" />
                      Loading relays...
                    </div>
                  ) : filteredRelayNames.length === 0 ? (
                    <div className="text-center text-muted-foreground py-4">
                      No relays found
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                      {filteredRelayNames.map((relayName) => (
                        <label
                          key={relayName}
                          className="flex items-center gap-2 cursor-pointer hover:bg-muted/50 p-1 rounded text-sm"
                        >
                          <Checkbox
                            checked={selectedRelays.includes(relayName)}
                            onCheckedChange={() => toggleRelay(relayName)}
                          />
                          <span className="truncate">{relayName}</span>
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Options */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="limit" className="text-sm font-medium">
                    Max Records
                  </Label>
                  <Select value={limit} onValueChange={setLimit}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="100">100</SelectItem>
                      <SelectItem value="500">500</SelectItem>
                      <SelectItem value="1000">1,000</SelectItem>
                      <SelectItem value="5000">5,000</SelectItem>
                      <SelectItem value="10000">10,000</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-end">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <Checkbox
                      checked={showMappedOnly}
                      onCheckedChange={(checked) => setShowMappedOnly(!!checked)}
                    />
                    <span className="text-sm">Show only mapped relays (with location)</span>
                  </label>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-2">
                <Button onClick={handleGenerateReport} disabled={loading}>
                  {loading ? (
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <RefreshCw className="h-4 w-4 mr-2" />
                  )}
                  Generate Report
                </Button>
                <Button
                  variant="outline"
                  onClick={handleDownloadCSV}
                  disabled={isDownloading || !reportData?.data}
                >
                  {isDownloading ? (
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Download className="h-4 w-4 mr-2" />
                  )}
                  Download CSV
                </Button>
              </div>
            </CardContent>
          </CollapsibleContent>
        </Collapsible>
      </Card>

      {/* Summary */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <Card>
            <CardContent className="pt-6">
              <p className="text-2xl font-bold">{summary.totalBlocks.toLocaleString()}</p>
              <p className="text-sm text-muted-foreground">Blocks</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <p className="text-2xl font-bold">{summary.totalRecords.toLocaleString()}</p>
              <p className="text-sm text-muted-foreground">Total Records</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <p className="text-2xl font-bold text-green-600">{summary.mappedRecords.toLocaleString()}</p>
              <p className="text-sm text-muted-foreground flex items-center gap-1">
                <MapPin className="h-3 w-3" /> Mapped
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <p className="text-2xl font-bold text-yellow-600">{summary.unmappedRecords.toLocaleString()}</p>
              <p className="text-sm text-muted-foreground flex items-center gap-1">
                <AlertCircle className="h-3 w-3" /> Unmapped
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <p className="text-2xl font-bold">{summary.uniqueRelays.toLocaleString()}</p>
              <p className="text-sm text-muted-foreground">Unique Relays</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Results Table */}
      {reportData?.data && (
        <Card>
          <CardHeader>
            <CardTitle>Report Results</CardTitle>
            <CardDescription>
              Showing {displayedReport.length.toLocaleString()} records
              {showMappedOnly && ` (${reportData.data.summary.totalRecords - displayedReport.length} unmapped hidden)`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="border rounded-md overflow-hidden">
              <div className="overflow-x-auto max-h-[600px]">
                <Table>
                  <TableHeader className="sticky top-0 bg-background z-10">
                    <TableRow>
                      <TableHead className="whitespace-nowrap">Block</TableHead>
                      <TableHead className="whitespace-nowrap">Relay</TableHead>
                      <TableHead className="whitespace-nowrap text-center">Rank</TableHead>
                      <TableHead className="whitespace-nowrap text-right">Latency</TableHead>
                      <TableHead className="whitespace-nowrap text-right">Loss</TableHead>
                      <TableHead className="whitespace-nowrap">Location</TableHead>
                      <TableHead className="whitespace-nowrap text-center">Lat</TableHead>
                      <TableHead className="whitespace-nowrap text-center">Lng</TableHead>
                      <TableHead className="whitespace-nowrap text-center">Mapped</TableHead>
                      <TableHead className="whitespace-nowrap">Created At</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {displayedReport.slice(0, 500).map((record, idx) => (
                      <TableRow key={`${record.block_number}-${record.relay_name}-${idx}`}>
                        <TableCell className="font-mono text-sm">
                          {record.block_number.toLocaleString()}
                        </TableCell>
                        <TableCell className="font-medium max-w-[200px] truncate">
                          {record.relay_name}
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge
                            variant={record.arrival_order === 0 ? 'default' : 'secondary'}
                            className={cn(
                              record.arrival_order === 0 && 'bg-yellow-500',
                              record.arrival_order === 1 && 'bg-gray-400',
                              record.arrival_order === 2 && 'bg-orange-400'
                            )}
                          >
                            #{record.arrival_order + 1}
                          </Badge>
                        </TableCell>
                        <TableCell className={cn(
                          'text-right font-mono text-sm',
                          record.latency < 50 && 'text-green-600',
                          record.latency >= 50 && record.latency < 100 && 'text-yellow-600',
                          record.latency >= 100 && 'text-red-600'
                        )}>
                          {record.latency.toFixed(1)}ms
                        </TableCell>
                        <TableCell className={cn(
                          'text-right font-mono text-sm',
                          record.loss < 0.5 && 'text-green-600',
                          record.loss >= 0.5 && record.loss < 1.5 && 'text-yellow-600',
                          record.loss >= 1.5 && 'text-red-600'
                        )}>
                          {record.loss.toFixed(2)}%
                        </TableCell>
                        <TableCell className="max-w-[150px] truncate text-muted-foreground">
                          {record.node_location || record.node_country || '-'}
                        </TableCell>
                        <TableCell className="text-center font-mono text-xs text-muted-foreground">
                          {record.node_latitude?.toFixed(4) || '-'}
                        </TableCell>
                        <TableCell className="text-center font-mono text-xs text-muted-foreground">
                          {record.node_longitude?.toFixed(4) || '-'}
                        </TableCell>
                        <TableCell className="text-center">
                          {record.is_mapped ? (
                            <CheckCircle2 className="h-4 w-4 text-green-500 mx-auto" />
                          ) : (
                            <AlertCircle className="h-4 w-4 text-yellow-500 mx-auto" />
                          )}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                          {formatDate(record.block_created_at)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              {displayedReport.length > 500 && (
                <div className="p-4 text-center text-sm text-muted-foreground bg-muted/50">
                  Showing first 500 of {displayedReport.length.toLocaleString()} records.
                  Download CSV for full data.
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Empty state */}
      {!reportData?.data && !loading && (
        <Card>
          <CardContent className="py-16 text-center">
            <FileSpreadsheet className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-2">No Report Generated</h3>
            <p className="text-muted-foreground mb-4">
              Configure your filters above and click &quot;Generate Report&quot; to view data
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
