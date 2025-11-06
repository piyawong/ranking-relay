'use client';

import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { formatLatency, formatLoss, formatRank } from '@/lib/utils/format';
import { cn } from '@/lib/utils';

interface RankingData {
  relay_name: string;
  latency: number;
  loss: number;
  arrival_order: number;
  ranking_score: number;
}

interface RankingTableProps {
  rankings: RankingData[];
  loading?: boolean;
}

export function RankingTable({ rankings, loading }: RankingTableProps) {
  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-muted-foreground">Loading rankings...</div>
      </div>
    );
  }

  if (rankings.length === 0) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-muted-foreground">No ranking data available</div>
      </div>
    );
  }

  return (
    <Table>
      <TableCaption>Real-time relay performance rankings</TableCaption>
      <TableHeader>
        <TableRow>
          <TableHead className="w-20">Rank</TableHead>
          <TableHead>Relay Name</TableHead>
          <TableHead className="text-right">Arrival Order</TableHead>
          <TableHead className="text-right">Latency</TableHead>
          <TableHead className="text-right">Packet Loss</TableHead>
          <TableHead className="text-right">Score</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rankings.map((relay, index) => (
          <TableRow key={`${relay.relay_name}-${index}`}>
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
              <span
                className={cn(
                  'inline-flex items-center px-2 py-1 rounded-full text-xs font-medium',
                  relay.arrival_order === 0 && 'bg-green-100 text-green-800',
                  relay.arrival_order > 0 && relay.arrival_order <= 2 && 'bg-blue-100 text-blue-800',
                  relay.arrival_order > 2 && 'bg-gray-100 text-gray-600'
                )}
              >
                {formatRank(relay.arrival_order + 1)}
              </span>
            </TableCell>
            <TableCell className="text-right">{formatLatency(relay.latency)}</TableCell>
            <TableCell className="text-right">
              <span
                className={cn(
                  relay.loss < 0.5 && 'text-green-600',
                  relay.loss >= 0.5 && relay.loss < 1.5 && 'text-yellow-600',
                  relay.loss >= 1.5 && 'text-red-600'
                )}
              >
                {formatLoss(relay.loss)}
              </span>
            </TableCell>
            <TableCell className="text-right font-mono">{relay.ranking_score.toFixed(2)}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}