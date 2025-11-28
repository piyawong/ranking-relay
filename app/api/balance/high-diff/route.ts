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
 *
 * OPTIMIZED: Uses windowed processing to avoid loading all snapshots
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const limit = parseInt(searchParams.get('limit') || '50', 10); // Process in batches
    const fastMode = searchParams.get('fast') === 'true'; // Skip deep analysis

    // Get total count first
    const totalCount = await prisma.balanceSnapshot.count();

    if (totalCount < 2) {
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
    const getTotals = (snapshot: any) => ({
      usdUsdt: decimalToNumber(snapshot.onsite_usd) + decimalToNumber(snapshot.onchain_usdt),
      rlb: decimalToNumber(snapshot.onsite_rlb) + decimalToNumber(snapshot.onchain_rlb)
    });

    // Process in windows to avoid loading all data
    const windowSize = 1000; // Process 1000 at a time
    let offset = 0;
    let previousSnapshot: any = null;

    while (offset < totalCount && anomalies.length < limit) {
      const snapshots = await prisma.balanceSnapshot.findMany({
        skip: offset,
        take: windowSize,
        orderBy: { timestamp: 'asc' },
        select: {
          id: true,
          timestamp: true,
          onsite_usd: true,
          onchain_usdt: true,
          onsite_rlb: true,
          onchain_rlb: true
        }
      });

      if (snapshots.length === 0) break;

      // Process this window
      for (let i = 0; i < snapshots.length && anomalies.length < limit; i++) {
        const current = getTotals(snapshots[i]);

        // For first snapshot in window, use previous from last window if exists
        let previous;
        if (i === 0 && previousSnapshot) {
          previous = getTotals(previousSnapshot);
        } else if (i > 0) {
          previous = getTotals(snapshots[i - 1]);
        } else {
          continue; // Skip first ever snapshot
        }

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

        // In fast mode, just mark current as anomaly
        let isCurrentAnomaly = true;

        if (!fastMode) {
          // Determine which snapshot is the outlier
          // Check if current is a "spike" by looking at the next snapshot
          const nextIdx = i + 1;
          if (nextIdx < snapshots.length) {
            const next = getTotals(snapshots[nextIdx]);

            // Calculate how close next is to previous vs current
            const nextToPrevUsdtDiff = Math.abs(next.usdUsdt - previous.usdUsdt);
            const nextToPrevRlbDiff = Math.abs(next.rlb - previous.rlb);

            // If next returns close to previous levels, current is likely a spike
            const nextReturnsToPrev = (
              (isUsdtAnomaly && nextToPrevUsdtDiff < usdtDiff * 0.4) ||
              (isRlbAnomaly && nextToPrevRlbDiff < rlbDiff * 0.4)
            );

            isCurrentAnomaly = nextReturnsToPrev;
          }
        }

        // Mark the anomalous snapshot
        const anomalySnapshot = isCurrentAnomaly ? snapshots[i] : (i > 0 ? snapshots[i - 1] : previousSnapshot);

        if (anomalySnapshot && !anomalyIds.has(anomalySnapshot.id)) {
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

      // Save last snapshot for next window
      previousSnapshot = snapshots[snapshots.length - 1];
      offset += windowSize;
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
