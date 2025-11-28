import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import type { ApiResponse } from '@/lib/types/api';

// GET /api/bloxroute - Get comparison between first relay and bloxroute for all blocks
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const offset = parseInt(searchParams.get('offset') || '0', 10);

    // Fetch blocks with bloxroute data and relay details
    const blocks = await prisma.block.findMany({
      where: {
        origin: { not: null },
        bloxroute_timestamp: { not: null },
      },
      include: {
        relay_details: {
          orderBy: { arrival_order: 'asc' },
          take: 1, // Only get first relay
        },
      },
      orderBy: { block_number: 'desc' },
      skip: offset,
      take: limit,
    });

    // Get total count
    const total = await prisma.block.count({
      where: {
        origin: { not: null },
        bloxroute_timestamp: { not: null },
      },
    });

    // Calculate overall statistics from entire database
    const allBlocksWithComparison = await prisma.block.findMany({
      where: {
        origin: { not: null },
        bloxroute_timestamp: { not: null },
        is_win_bloxroute: { not: null },
        time_difference_ms: { not: null },
      },
      select: {
        is_win_bloxroute: true,
        time_difference_ms: true,
      },
    });

    const totalComparisons = allBlocksWithComparison.length;
    const bloxrouteWins = allBlocksWithComparison.filter(b => b.is_win_bloxroute === true).length;
    const relayWins = totalComparisons - bloxrouteWins;
    const avgTimeDiff = totalComparisons > 0
      ? allBlocksWithComparison.reduce((sum, b) => {
          // Convert time_difference_ms to number, considering if relay won (negative) or bloxroute won (positive)
          const timeDiff = Number(b.time_difference_ms) || 0;
          return sum + (b.is_win_bloxroute ? timeDiff : -timeDiff);
        }, 0) / totalComparisons
      : 0;

    // Map comparison data from stored values (for current page only)
    const comparisons = blocks.map(block => {
      const firstRelay = block.relay_details[0];

      if (!firstRelay || !block.bloxroute_timestamp || block.is_win_bloxroute === null) {
        return null;
      }

      // Use stored comparison values
      const relayWon = !block.is_win_bloxroute;
      const timeDiff = block.time_difference_ms || 0;

      return {
        block_number: block.block_number,
        block_hash: block.block_hash,
        first_relay_name: firstRelay.relay_name,
        first_relay_timestamp: firstRelay.arrival_timestamp.toISOString(),
        bloxroute_origin: block.origin,
        bloxroute_timestamp: block.bloxroute_timestamp.toISOString(),
        relay_won: relayWon,
        time_difference_ms: relayWon ? -timeDiff : timeDiff, // Negative if relay won
        created_at: block.created_at.toISOString(),
      };
    }).filter(Boolean);

    return NextResponse.json<ApiResponse>({
      success: true,
      data: {
        comparisons,
        statistics: {
          total: totalComparisons,
          relay_wins: relayWins,
          bloxroute_wins: bloxrouteWins,
          relay_win_rate: totalComparisons > 0 ? (relayWins / totalComparisons) * 100 : 0,
          avg_time_difference_ms: avgTimeDiff,
        },
        pagination: {
          total,
          limit,
          offset,
          hasMore: offset + limit < total,
        },
      },
    });
  } catch (error) {
    console.error('Error fetching bloxroute comparison:', error);
    return NextResponse.json<ApiResponse>({
      success: false,
      error: 'Internal server error',
    }, { status: 500 });
  }
}
