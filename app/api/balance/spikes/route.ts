import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { decimalToNumber } from '@/lib/utils/format';
import type { ApiResponse } from '@/lib/types/api';

/**
 * GET /api/balance/spikes - Find all balance snapshots with jumps (lower threshold for manual review)
 *
 * Returns snapshots with:
 * - USDT/USD jumps > 500
 * - RLB jumps > 5000
 */
export async function GET(_request: NextRequest) {
  try {
    // Fetch all snapshots ordered by timestamp
    const snapshots = await prisma.balanceSnapshot.findMany({
      orderBy: { timestamp: 'asc' }
    });

    if (snapshots.length < 2) {
      return NextResponse.json<ApiResponse>({
        success: true,
        data: {
          spikes: [],
          count: 0
        }
      });
    }

    const spikes: {
      id: string;
      timestamp: string;
      usdUsdt: number;
      rlb: number;
      usdtJump: number;
      rlbJump: number;
      reason: string;
    }[] = [];

    // Helper: Calculate totals for a snapshot
    const getTotals = (snapshot: typeof snapshots[0]) => ({
      usdUsdt: decimalToNumber(snapshot.onsite_usd) + decimalToNumber(snapshot.onchain_usdt),
      rlb: decimalToNumber(snapshot.onsite_rlb) + decimalToNumber(snapshot.onchain_rlb)
    });

    // Check each snapshot against the previous one
    for (let i = 1; i < snapshots.length; i++) {
      const current = getTotals(snapshots[i]);
      const previous = getTotals(snapshots[i - 1]);

      // Calculate diffs
      const usdtJump = Math.abs(current.usdUsdt - previous.usdUsdt);
      const rlbJump = Math.abs(current.rlb - previous.rlb);

      // Lower thresholds for manual review
      const hasUsdtJump = usdtJump > 500;
      const hasRlbJump = rlbJump > 5000;

      if (hasUsdtJump || hasRlbJump) {
        const reasons = [];
        if (hasUsdtJump) reasons.push(`USDT/USD: ±${usdtJump.toFixed(2)}`);
        if (hasRlbJump) reasons.push(`RLB: ±${rlbJump.toFixed(2)}`);

        spikes.push({
          id: snapshots[i].id,
          timestamp: snapshots[i].timestamp.toISOString(),
          usdUsdt: current.usdUsdt,
          rlb: current.rlb,
          usdtJump,
          rlbJump,
          reason: reasons.join(', ')
        });
      }
    }

    return NextResponse.json<ApiResponse>({
      success: true,
      data: {
        spikes,
        count: spikes.length
      }
    });
  } catch (error) {
    console.error('Error finding balance spikes:', error);
    return NextResponse.json<ApiResponse>({
      success: false,
      error: 'Internal server error'
    }, { status: 500 });
  }
}
