import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import type { ApiResponse } from '@/lib/types/api';

// GET /api/bloxroute/origins - Get origin statistics from all blocks
export async function GET(_request: NextRequest) {
  try {
    // Get all blocks with origin data and comparison results
    const blocks = await prisma.block.findMany({
      where: {
        origin: { not: null },
        bloxroute_timestamp: { not: null },
        is_win_bloxroute: { not: null },
      },
      select: {
        origin: true,
        block_number: true,
        bloxroute_timestamp: true,
        is_win_bloxroute: true,
      },
    });

    // Count occurrences and calculate win/loss stats for each origin
    const originCounts: { [key: string]: number } = {};
    const originBlocks: { [key: string]: number[] } = {};
    const originRelayWins: { [key: string]: number } = {};
    const originBloxrouteWins: { [key: string]: number } = {};

    blocks.forEach(block => {
      if (block.origin && block.bloxroute_timestamp && block.is_win_bloxroute !== null) {
        // Count blocks per origin
        originCounts[block.origin] = (originCounts[block.origin] || 0) + 1;

        if (!originBlocks[block.origin]) {
          originBlocks[block.origin] = [];
          originRelayWins[block.origin] = 0;
          originBloxrouteWins[block.origin] = 0;
        }
        originBlocks[block.origin].push(block.block_number);

        // Use stored comparison result
        if (block.is_win_bloxroute) {
          originBloxrouteWins[block.origin]++;
        } else {
          originRelayWins[block.origin]++;
        }
      }
    });

    // Convert to array and sort by count
    const originStats = Object.entries(originCounts).map(([origin, count]) => {
      const relayWins = originRelayWins[origin] || 0;
      const bloxrouteWins = originBloxrouteWins[origin] || 0;
      const total = relayWins + bloxrouteWins;

      return {
        origin,
        count,
        percentage: (count / blocks.length) * 100,
        relay_wins: relayWins,
        bloxroute_wins: bloxrouteWins,
        relay_win_percentage: total > 0 ? (relayWins / total) * 100 : 0,
        bloxroute_win_percentage: total > 0 ? (bloxrouteWins / total) * 100 : 0,
        blocks: originBlocks[origin].sort((a, b) => b - a), // Sort blocks descending
      };
    }).sort((a, b) => b.count - a.count);

    return NextResponse.json<ApiResponse>({
      success: true,
      data: {
        total_blocks: blocks.length,
        unique_origins: originStats.length,
        origins: originStats,
      },
    });
  } catch (error) {
    console.error('Error fetching origin statistics:', error);
    return NextResponse.json<ApiResponse>({
      success: false,
      error: 'Internal server error',
    }, { status: 500 });
  }
}
