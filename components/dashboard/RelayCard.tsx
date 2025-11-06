'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { formatLatency, formatLoss, formatNumber } from '@/lib/utils/format';
import { cn } from '@/lib/utils';
import { TrendingUp, TrendingDown, Activity, Zap } from 'lucide-react';

interface RelayCardProps {
  relayName: string;
  totalBlocks: number;
  avgLatency: number;
  avgLoss: number;
  firstArrivalCount: number;
  lastUpdated?: string;
  trend?: 'up' | 'down' | 'stable';
}

export function RelayCard({
  relayName,
  totalBlocks,
  avgLatency,
  avgLoss,
  firstArrivalCount,
  trend = 'stable',
}: RelayCardProps) {
  const firstArrivalPercentage = totalBlocks > 0 ? (firstArrivalCount / totalBlocks) * 100 : 0;
  const performanceScore = 100 - (avgLatency * 0.3 + avgLoss * 10); // Simple performance metric

  return (
    <Card className="hover:shadow-lg transition-shadow">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-semibold">{relayName}</CardTitle>
          {trend === 'up' && <TrendingUp className="h-4 w-4 text-green-500" />}
          {trend === 'down' && <TrendingDown className="h-4 w-4 text-red-500" />}
          {trend === 'stable' && <Activity className="h-4 w-4 text-gray-500" />}
        </div>
        <CardDescription>Performance Metrics</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Avg Latency</p>
            <p className="text-lg font-medium">{formatLatency(avgLatency)}</p>
          </div>
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Avg Loss</p>
            <p
              className={cn(
                'text-lg font-medium',
                avgLoss < 0.5 && 'text-green-600',
                avgLoss >= 0.5 && avgLoss < 1.5 && 'text-yellow-600',
                avgLoss >= 1.5 && 'text-red-600'
              )}
            >
              {formatLoss(avgLoss)}
            </p>
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Total Blocks</span>
            <span className="font-medium">{totalBlocks.toLocaleString()}</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground flex items-center gap-1">
              <Zap className="h-3 w-3" />
              First Arrivals
            </span>
            <span className="font-medium">
              {firstArrivalCount} ({formatNumber(firstArrivalPercentage, 1)}%)
            </span>
          </div>
        </div>

        <div className="pt-2 border-t">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">Performance Score</span>
            <div className="flex items-center gap-2">
              <div className="w-20 h-2 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className={cn(
                    'h-full transition-all',
                    performanceScore >= 80 && 'bg-green-500',
                    performanceScore >= 60 && performanceScore < 80 && 'bg-yellow-500',
                    performanceScore < 60 && 'bg-red-500'
                  )}
                  style={{ width: `${Math.max(0, Math.min(100, performanceScore))}%` }}
                />
              </div>
              <span className="text-xs font-medium">{formatNumber(performanceScore, 0)}</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}