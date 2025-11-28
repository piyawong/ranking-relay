import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { decimalToNumber } from '@/lib/utils/format';
import type { ApiResponse } from '@/lib/types/api';

/**
 * POST /api/balance/high-diff/purge-range - Smart purge of high-diff snapshots
 *
 * Instead of deleting one anomaly at a time (which causes cascade),
 * this finds the anomalous TIME RANGES and deletes ALL snapshots in those ranges.
 *
 * Query params:
 * - dryRun: If 'true', just report what would be deleted
 */
export async function POST(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const dryRun = searchParams.get('dryRun') === 'true';

    // Step 1: Find all anomalous ranges
    const ranges = await findAnomalousRanges();

    if (ranges.length === 0) {
      return NextResponse.json<ApiResponse>({
        success: true,
        message: 'No anomalous ranges found',
        data: { deletedCount: 0, ranges: [] }
      });
    }

    let totalDeleted = 0;
    const deletedRanges: any[] = [];

    for (const range of ranges) {
      if (!dryRun) {
        // Delete ALL snapshots in this time range
        const result = await prisma.balanceSnapshot.deleteMany({
          where: {
            timestamp: {
              gte: range.startTime,
              lte: range.endTime
            }
          }
        });
        totalDeleted += result.count;
        deletedRanges.push({ ...range, deletedCount: result.count });
      } else {
        // Count what would be deleted
        const count = await prisma.balanceSnapshot.count({
          where: {
            timestamp: {
              gte: range.startTime,
              lte: range.endTime
            }
          }
        });
        deletedRanges.push({ ...range, wouldDelete: count });
        totalDeleted += count;
      }
    }

    const message = dryRun
      ? `Dry run: Would delete ${totalDeleted} snapshots across ${ranges.length} ranges`
      : `Purged ${totalDeleted} snapshots across ${ranges.length} anomalous ranges`;

    return NextResponse.json<ApiResponse>({
      success: true,
      message,
      data: {
        deletedCount: totalDeleted,
        rangeCount: ranges.length,
        dryRun,
        ranges: deletedRanges
      }
    });

  } catch (error) {
    console.error('Error purging high-diff ranges:', error);
    return NextResponse.json<ApiResponse>({
      success: false,
      error: 'Internal server error'
    }, { status: 500 });
  }
}

/**
 * Find time ranges where anomalies exist
 * Groups consecutive anomalies into ranges
 */
async function findAnomalousRanges() {
  const totalCount = await prisma.balanceSnapshot.count();
  if (totalCount < 2) return [];

  const getTotals = (snapshot: any) => ({
    usdUsdt: decimalToNumber(snapshot.onsite_usd) + decimalToNumber(snapshot.onchain_usdt),
    rlb: decimalToNumber(snapshot.onsite_rlb) + decimalToNumber(snapshot.onchain_rlb)
  });

  // Get all snapshots ordered by time
  const snapshots = await prisma.balanceSnapshot.findMany({
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

  // Find the "normal" baseline (median values)
  const allUsdUsdt = snapshots.map(s => getTotals(s).usdUsdt);
  const allRlb = snapshots.map(s => getTotals(s).rlb);

  allUsdUsdt.sort((a, b) => a - b);
  allRlb.sort((a, b) => a - b);

  const medianUsdUsdt = allUsdUsdt[Math.floor(allUsdUsdt.length / 2)];
  const medianRlb = allRlb[Math.floor(allRlb.length / 2)];

  // Mark snapshots as anomalous if they deviate significantly from median
  const anomalyThresholdUsdt = 300;
  const anomalyThresholdRlb = 999;

  const ranges: { startTime: Date; endTime: Date; reason: string }[] = [];
  let currentRange: { startTime: Date; endTime: Date; reason: string } | null = null;

  for (const snapshot of snapshots) {
    const totals = getTotals(snapshot);
    const usdtDiff = Math.abs(totals.usdUsdt - medianUsdUsdt);
    const rlbDiff = Math.abs(totals.rlb - medianRlb);

    const isAnomaly = usdtDiff > anomalyThresholdUsdt || rlbDiff > anomalyThresholdRlb;

    if (isAnomaly) {
      if (!currentRange) {
        // Start new range
        currentRange = {
          startTime: snapshot.timestamp,
          endTime: snapshot.timestamp,
          reason: `USDT diff: ${usdtDiff.toFixed(0)}, RLB diff: ${rlbDiff.toFixed(0)}`
        };
      } else {
        // Extend current range
        currentRange.endTime = snapshot.timestamp;
      }
    } else {
      if (currentRange) {
        // Close current range
        ranges.push(currentRange);
        currentRange = null;
      }
    }
  }

  // Don't forget last range
  if (currentRange) {
    ranges.push(currentRange);
  }

  return ranges;
}

/**
 * GET - Preview anomalous ranges
 */
export async function GET() {
  try {
    const ranges = await findAnomalousRanges();

    // Get counts for each range
    const rangesWithCounts = await Promise.all(
      ranges.map(async (range) => {
        const count = await prisma.balanceSnapshot.count({
          where: {
            timestamp: {
              gte: range.startTime,
              lte: range.endTime
            }
          }
        });
        return {
          ...range,
          startTime: range.startTime.toISOString(),
          endTime: range.endTime.toISOString(),
          snapshotCount: count
        };
      })
    );

    const totalSnapshots = rangesWithCounts.reduce((sum, r) => sum + r.snapshotCount, 0);

    return NextResponse.json<ApiResponse>({
      success: true,
      message: `Found ${ranges.length} anomalous ranges with ${totalSnapshots} total snapshots`,
      data: {
        rangeCount: ranges.length,
        totalSnapshots,
        ranges: rangesWithCounts
      }
    });
  } catch (error) {
    console.error('Error finding anomalous ranges:', error);
    return NextResponse.json<ApiResponse>({
      success: false,
      error: 'Internal server error'
    }, { status: 500 });
  }
}
