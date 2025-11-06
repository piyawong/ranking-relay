'use client';

import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { RankingTable } from '@/components/dashboard/RankingTable';
import { PerformanceChart } from '@/components/dashboard/PerformanceChart';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { formatTimestamp } from '@/lib/utils/format';
import { ArrowLeft } from 'lucide-react';

// Fetch block data
async function fetchBlockData(blockNumber: string) {
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

// Fetch relay history for charts
async function fetchRelayHistory(relayName: string) {
  const response = await fetch(`/api/rankings?relayName=${encodeURIComponent(relayName)}&limit=50`);
  if (!response.ok) throw new Error('Failed to fetch relay history');
  const data = await response.json();
  return data.data;
}

export default function BlockDetailPage({
  params,
}: {
  params: { blockNumber: string };
}) {
  const router = useRouter();
  const blockNumber = params.blockNumber;

  // Fetch block data
  const {
    data: blockData,
    isLoading: blockLoading,
    error: blockError,
  } = useQuery({
    queryKey: ['block', blockNumber],
    queryFn: () => fetchBlockData(blockNumber),
  });

  // Transform rankings data for the table
  const rankings = blockData?.relay_details?.map((detail: {
    relay_name: string;
    latency: number;
    loss: number;
    arrival_order: number;
    ranking_score: number;
  }) => ({
    relay_name: detail.relay_name,
    latency: detail.latency,
    loss: detail.loss,
    arrival_order: detail.arrival_order,
    ranking_score: detail.ranking_score,
  })) || [];

  // Get the top performer for chart display
  const topPerformer = rankings[0];

  // Fetch history for the top performer
  const { data: historyData } = useQuery({
    queryKey: ['relayHistory', topPerformer?.relay_name],
    queryFn: () => fetchRelayHistory(topPerformer.relay_name),
    enabled: !!topPerformer,
  });

  // Transform history data for chart
  const chartData = historyData?.data?.map((item: {
    block_number: number;
    latency: number;
    loss: number;
    ranking_score: number;
  }) => ({
    block_number: item.block_number,
    latency: item.latency,
    loss: item.loss,
    ranking_score: item.ranking_score,
  })) || [];

  if (blockError) {
    return (
      <div className="space-y-6">
        <Button variant="ghost" onClick={() => router.push('/dashboard')}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Dashboard
        </Button>
        <Card className="border-red-200 bg-red-50">
          <CardHeader>
            <CardTitle className="text-red-800">Error</CardTitle>
            <CardDescription className="text-red-600">
              {blockError.message === 'Block not found'
                ? `Block #${blockNumber} not found. It may not exist yet.`
                : 'Failed to load block data. Please try again.'}
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Navigation */}
      <div className="flex items-center justify-between">
        <Button variant="ghost" onClick={() => router.push('/dashboard')}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Dashboard
        </Button>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => router.push(`/dashboard/${parseInt(blockNumber) - 1}`)}
            disabled={parseInt(blockNumber) <= 1}
          >
            Previous Block
          </Button>
          <Button
            variant="outline"
            onClick={() => router.push(`/dashboard/${parseInt(blockNumber) + 1}`)}
          >
            Next Block
          </Button>
        </div>
      </div>

      {/* Block Information */}
      <Card>
        <CardHeader>
          <CardTitle>Block #{blockNumber}</CardTitle>
          <CardDescription>
            {blockData && `Created: ${formatTimestamp(blockData.created_at)}`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Total Relays</p>
              <p className="text-2xl font-bold">{rankings.length}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Best Latency</p>
              <p className="text-2xl font-bold">
                {rankings.length > 0 ? `${Math.min(...rankings.map((r: { latency: number }) => r.latency)).toFixed(1)}ms` : '-'}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Winner</p>
              <p className="text-2xl font-bold">{topPerformer?.relay_name || '-'}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Rankings Table */}
      <Card>
        <CardHeader>
          <CardTitle>Relay Rankings</CardTitle>
          <CardDescription>Performance metrics for all relays in this block</CardDescription>
        </CardHeader>
        <CardContent>
          <RankingTable rankings={rankings} loading={blockLoading} />
        </CardContent>
      </Card>

      {/* Performance Chart for Top Performer */}
      {topPerformer && (
        <Card>
          <CardHeader>
            <CardTitle>Historical Performance</CardTitle>
            <CardDescription>
              Tracking {topPerformer.relay_name} performance over recent blocks
            </CardDescription>
          </CardHeader>
          <CardContent>
            <PerformanceChart
              data={chartData}
              relayName={topPerformer.relay_name}
              loading={!historyData}
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
}