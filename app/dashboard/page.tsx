'use client';

import { useState, useEffect, Suspense } from 'react';
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
import { RefreshCw, Search, Award, Zap, Timer, Package } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatTimestamp } from '@/lib/utils/format';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';

// Fetch block data by block number
async function fetchBlockData(blockNumber: number) {
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

function DashboardContent() {
  const searchParams = useSearchParams();
  const [blockInput, setBlockInput] = useState('');
  const [selectedBlock, setSelectedBlock] = useState<number | null>(null);

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

  // Fetch latest block (no auto-refresh)
  const { data: latestBlock, refetch: refetchLatest, isLoading: latestLoading } = useQuery({
    queryKey: ['latest-block'],
    queryFn: fetchLatestBlock,
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
    }
  };

  // Handle refresh - refresh both latest block info and current block data
  const handleRefresh = () => {
    refetchLatest();
    if (currentBlockNumber > 0) {
      refetchBlock();
    }
  };

  // Sort relay details by arrival order
  const relayDetails = blockData?.relay_details?.sort((a: any, b: any) => {
    return a.arrival_order - b.arrival_order;
  }) || [];

  const loading = latestLoading || blockLoading;

  return (
    <div className="space-y-6">
      {/* Header Section */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold">Block Details Dashboard</h1>
          <p className="text-muted-foreground">
            View detailed relay performance for each block
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/rankings">
            <Button variant="outline" size="sm">
              <Award className="h-4 w-4 mr-2" />
              View Rankings
            </Button>
          </Link>
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={loading}
          >
            <RefreshCw className={cn('h-4 w-4 mr-2', loading && 'animate-spin')} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Block Search and Navigation */}
      <Card>
        <CardHeader>
          <CardTitle>Search Block</CardTitle>
          <CardDescription>
            Enter a block number to view its details
            {latestBlock && ` (Latest: #${latestBlock.block_number})`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleBlockSearch} className="flex gap-2 flex-wrap">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="number"
                placeholder="Enter block number..."
                value={blockInput}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setBlockInput(e.target.value)}
                className="pl-10"
                min="1"
              />
            </div>
            <Button type="submit">Go to Block</Button>
            {latestBlock && (
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setSelectedBlock(latestBlock.block_number);
                  setBlockInput(latestBlock.block_number.toString());
                }}
              >
                Latest Block
              </Button>
            )}
          </form>

          {/* Block Navigation */}
          {currentBlockNumber > 0 && (
            <div className="flex items-center justify-center gap-2 mt-4 pt-4 border-t">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const prevBlock = currentBlockNumber - 1;
                  if (prevBlock >= 1) {
                    setSelectedBlock(prevBlock);
                    setBlockInput(prevBlock.toString());
                  }
                }}
                disabled={currentBlockNumber <= 1}
              >
                ← Previous Block
              </Button>
              <span className="text-sm text-muted-foreground px-4">
                Block #{currentBlockNumber}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const nextBlock = currentBlockNumber + 1;
                  setSelectedBlock(nextBlock);
                  setBlockInput(nextBlock.toString());
                }}
                disabled={latestBlock && currentBlockNumber >= latestBlock.block_number}
              >
                Next Block →
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Block Info and Relay Details */}
      {blockError ? (
        <Card className="border-yellow-200 bg-yellow-50">
          <CardHeader>
            <CardTitle className="text-yellow-800">Block Not Found</CardTitle>
            <CardDescription className="text-yellow-600">
              Block #{currentBlockNumber} does not exist or hasn't been created yet.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : blockData && (
        <>
          {/* Block Summary */}
          <Card>
            <CardHeader>
              <CardTitle>Block #{currentBlockNumber}</CardTitle>
              <CardDescription>
                Created: {formatTimestamp(blockData.created_at)}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-blue-100">
                    <Package className="h-5 w-5 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Total Relays</p>
                    <p className="text-2xl font-bold">{relayDetails.length}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-green-100">
                    <Award className="h-5 w-5 text-green-600" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">First Arrival</p>
                    <p className="text-2xl font-bold truncate">
                      {relayDetails[0]?.relay_name || '-'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-purple-100">
                    <Zap className="h-5 w-5 text-purple-600" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Best Latency</p>
                    <p className="text-2xl font-bold">
                      {relayDetails.length > 0
                        ? `${Math.min(...relayDetails.map((r: any) => r.latency)).toFixed(1)}ms`
                        : '-'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-orange-100">
                    <Timer className="h-5 w-5 text-orange-600" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Lowest Loss</p>
                    <p className="text-2xl font-bold">
                      {relayDetails.length > 0
                        ? `${Math.min(...relayDetails.map((r: any) => r.loss)).toFixed(2)}%`
                        : '-'}
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Relay Details Table */}
          <Card>
            <CardHeader>
              <CardTitle>Relay Details</CardTitle>
              <CardDescription>
                Detailed performance metrics for each relay in this block
              </CardDescription>
            </CardHeader>
            <CardContent>
              {relayDetails.length === 0 ? (
                <div className="flex items-center justify-center p-8">
                  <div className="text-muted-foreground">No relay data available</div>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-24">Arrival</TableHead>
                      <TableHead>Relay Name</TableHead>
                      <TableHead className="text-right">Latency</TableHead>
                      <TableHead className="text-right">Packet Loss</TableHead>
                      <TableHead className="text-right">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {relayDetails.map((relay: any, index: number) => (
                      <TableRow key={relay.id}>
                        <TableCell>
                          <span
                            className={cn(
                              'inline-flex items-center justify-center w-10 h-10 rounded-full text-sm font-bold',
                              index === 0 && 'bg-green-100 text-green-800',
                              index === 1 && 'bg-blue-100 text-blue-800',
                              index === 2 && 'bg-yellow-100 text-yellow-800',
                              index > 2 && 'bg-gray-100 text-gray-700'
                            )}
                          >
                            {index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : index + 1}
                          </span>
                        </TableCell>
                        <TableCell className="font-medium text-lg">
                          {relay.relay_name}
                        </TableCell>
                        <TableCell className="text-right">
                          <span
                            className={cn(
                              'text-lg font-mono font-semibold',
                              relay.latency < 50 && 'text-green-600',
                              relay.latency >= 50 && relay.latency < 100 && 'text-yellow-600',
                              relay.latency >= 100 && 'text-red-600'
                            )}
                          >
                            {relay.latency.toFixed(1)}ms
                          </span>
                        </TableCell>
                        <TableCell className="text-right">
                          <span
                            className={cn(
                              'text-lg font-mono font-semibold',
                              relay.loss < 0.5 && 'text-green-600',
                              relay.loss >= 0.5 && relay.loss < 1.5 && 'text-yellow-600',
                              relay.loss >= 1.5 && 'text-red-600'
                            )}
                          >
                            {relay.loss.toFixed(2)}%
                          </span>
                        </TableCell>
                        <TableCell className="text-right">
                          {index === 0 ? (
                            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                              Fastest
                            </span>
                          ) : relay.latency < 100 ? (
                            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                              Good
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-700">
                              Average
                            </span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </>
      )}

      {/* Loading State */}
      {loading && !blockData && (
        <Card>
          <CardContent className="py-12">
            <div className="flex flex-col items-center justify-center gap-2">
              <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
              <p className="text-muted-foreground">Loading block data...</p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default function DashboardPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center p-8">
        <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    }>
      <DashboardContent />
    </Suspense>
  );
}
