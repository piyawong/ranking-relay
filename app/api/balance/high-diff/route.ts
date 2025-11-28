import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { decimalToNumber } from '@/lib/utils/format';
import type { ApiResponse } from '@/lib/types/api';

/**
 * GET /api/balance/high-diff - Find balance snapshots with abnormal changes
 *
 * Detects snapshots with large jumps in values:
 * - Total stablecoins (USD + USDT): ±300
 * - Total RLB: ±999
 */
export async function GET(_request: NextRequest) {
  try {
    // Fetch all snapshots ordered by timestamp
    const snapshots = await prisma.balanceSnapshot.findMany({
      orderBy: { timestamp: 'asc' }
    });

    if (snapshots.length < 2) {
      return NextResponse.json<ApiResponse<{ snapshotIds: string[]; count: number; details: any[] }>>({
        success: true,
        data: {
          snapshotIds: [],
          count: 0,
          details: []
        }
      });
    }

    const anomalies: {
      id: string;
      timestamp: string;
      usdtDiff: number;
      rlbDiff: number;
      reason: string;
    }[] = [];

    // Track which snapshots have been marked as anomalies
    const anomalyIds = new Set<string>();

    // Helper: Calculate totals for a snapshot
    const getTotals = (snapshot: typeof snapshots[0]) => ({
      usdUsdt: decimalToNumber(snapshot.onsite_usd) + decimalToNumber(snapshot.onchain_usdt),
      rlb: decimalToNumber(snapshot.onsite_rlb) + decimalToNumber(snapshot.onchain_rlb)
    });

    // Improved anomaly detection: Check each snapshot for outliers
    // Strategy: A snapshot is an outlier if it has a large jump AND:
    // 1. It's a spike (value returns to normal after)
    // 2. Or it's the start of a significant trend change
    for (let i = 1; i < snapshots.length; i++) {
      const current = getTotals(snapshots[i]);
      const previous = getTotals(snapshots[i - 1]);

      // Calculate diffs from previous
      const usdtDiff = Math.abs(current.usdUsdt - previous.usdUsdt);
      const rlbDiff = Math.abs(current.rlb - previous.rlb);

      // Check if exceeds thresholds
      const isUsdtAnomaly = usdtDiff > 300;
      const isRlbAnomaly = rlbDiff > 999;

      if (!isUsdtAnomaly && !isRlbAnomaly) {
        continue;
      }

      // Build reason strings
      const reasons: string[] = [];
      if (isUsdtAnomaly) reasons.push(`USDT/USD: ±${usdtDiff.toFixed(2)}`);
      if (isRlbAnomaly) reasons.push(`RLB: ±${rlbDiff.toFixed(2)}`);

      // Determine which snapshot is the outlier
      // Check if current is a "spike" by looking at the next snapshot
      let isCurrentAnomaly = true;

      if (i + 1 < snapshots.length) {
        const next = getTotals(snapshots[i + 1]);

        // Calculate how close next is to previous vs current
        const nextToPrevUsdtDiff = Math.abs(next.usdUsdt - previous.usdUsdt);
        const nextToPrevRlbDiff = Math.abs(next.rlb - previous.rlb);

        // If next returns close to previous levels, current is likely a spike
        // Reduced threshold from 0.5 to 0.4 to catch more spikes
        const nextReturnsToPrev = (
          (isUsdtAnomaly && nextToPrevUsdtDiff < usdtDiff * 0.4) ||
          (isRlbAnomaly && nextToPrevRlbDiff < rlbDiff * 0.4)
        );

        isCurrentAnomaly = nextReturnsToPrev;
      }

      // Mark the anomalous snapshot
      const anomalySnapshot = isCurrentAnomaly ? snapshots[i] : snapshots[i - 1];

      if (!anomalyIds.has(anomalySnapshot.id)) {
        anomalyIds.add(anomalySnapshot.id);
        anomalies.push({
          id: anomalySnapshot.id,
          timestamp: anomalySnapshot.timestamp.toISOString(),
          usdtDiff,
          rlbDiff,
          reason: reasons.join(', ')
        });
      }
    }

    const snapshotIds = anomalies.map(a => a.id);

    return NextResponse.json<ApiResponse<{ snapshotIds: string[]; count: number; details: typeof anomalies }>>({
      success: true,
      data: {
        snapshotIds,
        count: snapshotIds.length,
        details: anomalies
      }
    });
  } catch (error) {
    console.error('Error finding high diff balance snapshots:', error);
    return NextResponse.json<ApiResponse>({
      success: false,
      error: 'Internal server error'
    }, { status: 500 });
  }
}
