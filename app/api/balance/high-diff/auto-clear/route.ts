import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { decimalToNumber } from '@/lib/utils/format';
import type { ApiResponse } from '@/lib/types/api';

/**
 * POST /api/balance/high-diff/auto-clear - Automatically clear all high-diff snapshots
 *
 * This endpoint loops until no more high-diff anomalies are found.
 * After deleting a snapshot, consecutive snapshots may become new anomalies,
 * so we keep checking and deleting until clean.
 *
 * Query params:
 * - maxIterations: Maximum number of clear iterations (default: 100, safety limit)
 * - dryRun: If 'true', just report what would be deleted without actually deleting
 */
export async function POST(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const maxIterations = parseInt(searchParams.get('maxIterations') || '100', 10);
    const dryRun = searchParams.get('dryRun') === 'true';

    const deletedSnapshots: {
      id: string;
      timestamp: string;
      usdtDiff: number;
      rlbDiff: number;
      reason: string;
      iteration: number;
    }[] = [];

    let iteration = 0;

    while (iteration < maxIterations) {
      iteration++;

      // Find current high-diff anomalies
      const anomalies = await findHighDiffAnomalies(1); // Get one at a time for safety

      if (anomalies.length === 0) {
        // No more anomalies found
        break;
      }

      const anomaly = anomalies[0];

      if (!dryRun) {
        // Delete the snapshot
        await prisma.balanceSnapshot.delete({
          where: { id: anomaly.id }
        });
      }

      deletedSnapshots.push({
        ...anomaly,
        iteration
      });
    }

    const message = dryRun
      ? `Dry run: Would delete ${deletedSnapshots.length} snapshots in ${iteration} iterations`
      : `Auto-cleared ${deletedSnapshots.length} high-diff snapshots in ${iteration} iterations`;

    return NextResponse.json<ApiResponse>({
      success: true,
      message,
      data: {
        deletedCount: deletedSnapshots.length,
        iterations: iteration,
        reachedLimit: iteration >= maxIterations,
        dryRun,
        deleted: deletedSnapshots
      }
    });

  } catch (error) {
    console.error('Error auto-clearing high-diff snapshots:', error);
    return NextResponse.json<ApiResponse>({
      success: false,
      error: 'Internal server error'
    }, { status: 500 });
  }
}

/**
 * Find high-diff anomalies (same logic as high-diff/route.ts GET)
 */
async function findHighDiffAnomalies(limit: number = 50) {
  const totalCount = await prisma.balanceSnapshot.count();

  if (totalCount < 2) {
    return [];
  }

  const anomalies: {
    id: string;
    timestamp: string;
    usdtDiff: number;
    rlbDiff: number;
    reason: string;
  }[] = [];

  const anomalyIds = new Set<string>();

  const getTotals = (snapshot: any) => ({
    usdUsdt: decimalToNumber(snapshot.onsite_usd) + decimalToNumber(snapshot.onchain_usdt),
    rlb: decimalToNumber(snapshot.onsite_rlb) + decimalToNumber(snapshot.onchain_rlb)
  });

  const windowSize = 1000;
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

    for (let i = 0; i < snapshots.length && anomalies.length < limit; i++) {
      const current = getTotals(snapshots[i]);

      let previous;
      if (i === 0 && previousSnapshot) {
        previous = getTotals(previousSnapshot);
      } else if (i > 0) {
        previous = getTotals(snapshots[i - 1]);
      } else {
        continue;
      }

      const usdtDiff = Math.abs(current.usdUsdt - previous.usdUsdt);
      const rlbDiff = Math.abs(current.rlb - previous.rlb);

      const isUsdtAnomaly = usdtDiff > 300;
      const isRlbAnomaly = rlbDiff > 999;

      if (!isUsdtAnomaly && !isRlbAnomaly) {
        continue;
      }

      const reasons: string[] = [];
      if (isUsdtAnomaly) reasons.push(`USDT/USD: ±${usdtDiff.toFixed(2)}`);
      if (isRlbAnomaly) reasons.push(`RLB: ±${rlbDiff.toFixed(2)}`);

      // Determine which snapshot is the outlier
      let isCurrentAnomaly = true;
      const nextIdx = i + 1;
      if (nextIdx < snapshots.length) {
        const next = getTotals(snapshots[nextIdx]);
        const nextToPrevUsdtDiff = Math.abs(next.usdUsdt - previous.usdUsdt);
        const nextToPrevRlbDiff = Math.abs(next.rlb - previous.rlb);
        const nextReturnsToPrev = (
          (isUsdtAnomaly && nextToPrevUsdtDiff < usdtDiff * 0.4) ||
          (isRlbAnomaly && nextToPrevRlbDiff < rlbDiff * 0.4)
        );
        isCurrentAnomaly = nextReturnsToPrev;
      }

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

    previousSnapshot = snapshots[snapshots.length - 1];
    offset += windowSize;
  }

  return anomalies;
}

/**
 * GET /api/balance/high-diff/auto-clear - Preview what would be cleared
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const maxIterations = parseInt(searchParams.get('maxIterations') || '100', 10);

  // Simulate the clearing process without actually deleting
  const url = new URL(request.url);
  url.searchParams.set('dryRun', 'true');

  // Just return current high-diff count as preview
  const anomalies = await findHighDiffAnomalies(50);

  return NextResponse.json<ApiResponse>({
    success: true,
    message: `Found ${anomalies.length} high-diff snapshots. Use POST to auto-clear.`,
    data: {
      currentCount: anomalies.length,
      maxIterations,
      details: anomalies
    }
  });
}
