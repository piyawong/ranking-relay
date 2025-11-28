import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import type { ApiResponse } from '@/lib/types/api';

// GET /api/bloxroute/origins - Get origin statistics from all blocks
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const blockRangeStart = searchParams.get('blockRangeStart') ? parseInt(searchParams.get('blockRangeStart')!, 10) : null;
    const blockRangeEnd = searchParams.get('blockRangeEnd') ? parseInt(searchParams.get('blockRangeEnd')!, 10) : null;
    const lastBlocks = searchParams.get('lastBlocks') ? parseInt(searchParams.get('lastBlocks')!, 10) : null;
    const location = searchParams.get('location');
    const excludeLocations = searchParams.get('excludeLocations')?.split(',').filter(Boolean) || [];
    const excludeRelays = searchParams.get('excludeRelays')?.split(',').filter(Boolean) || [];
    const dateFrom = searchParams.get('dateFrom');
    const dateTo = searchParams.get('dateTo');

    // Build where clause
    const whereClause: any = {
      origin: { not: null },
      bloxroute_timestamp: { not: null },
      is_win_bloxroute: { not: null },
    };

    // Add location filter if specified
    if (location && location !== 'all') {
      whereClause.origin = location;
    }

    // Exclude locations
    if (excludeLocations.length > 0) {
      if (whereClause.origin === undefined || typeof whereClause.origin === 'string') {
        whereClause.origin = {
          notIn: excludeLocations,
          ...(location && location !== 'all' ? { equals: location } : { not: null })
        };
      }
    }

    // Handle block range filter
    if (blockRangeStart !== null && blockRangeEnd !== null) {
      whereClause.block_number = {
        gte: blockRangeStart,
        lte: blockRangeEnd,
      };
    }
    // Handle last blocks filter
    else if (lastBlocks && lastBlocks > 0) {
      // Get the latest X block numbers with origin data
      const latestBlocks = await prisma.block.findMany({
        where: {
          origin: { not: null },
          bloxroute_timestamp: { not: null },
          is_win_bloxroute: { not: null },
        },
        orderBy: { block_number: 'desc' },
        take: lastBlocks,
        select: { block_number: true },
      });

      if (latestBlocks.length > 0) {
        const blockNumbers = latestBlocks.map(b => b.block_number);
        whereClause.block_number = {
          in: blockNumbers,
        };
      }
    }

    // Handle date range filter
    if (dateFrom || dateTo) {
      whereClause.created_at = {};
      if (dateFrom) {
        whereClause.created_at.gte = new Date(dateFrom);
      }
      if (dateTo) {
        // Add one day to include the entire end date
        const endDate = new Date(dateTo);
        endDate.setDate(endDate.getDate() + 1);
        whereClause.created_at.lte = endDate;
      }
    }

    // Get blocks with origin data and comparison results
    const blocks = await prisma.block.findMany({
      where: whereClause,
      include: {
        relay_details: {
          orderBy: { arrival_order: 'asc' },
          take: 1, // Only get first relay for filtering
        },
      },
    });

    // Count occurrences and calculate win/loss stats for each origin
    const originCounts: { [key: string]: number } = {};
    const originBlocks: { [key: string]: number[] } = {};
    const originRelayWins: { [key: string]: number } = {};
    const originBloxrouteWins: { [key: string]: number } = {};

    blocks.forEach(block => {
      if (block.origin && block.is_win_bloxroute !== null) {
        const firstRelay = block.relay_details[0];

        // Skip if relay is excluded
        if (excludeRelays.length > 0 && firstRelay && excludeRelays.includes(firstRelay.relay_name)) {
          return;
        }

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
