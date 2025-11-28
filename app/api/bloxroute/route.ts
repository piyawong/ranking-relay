import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import type { ApiResponse } from '@/lib/types/api';

// GET /api/bloxroute - Get comparison between first relay and bloxroute for all blocks
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const offset = parseInt(searchParams.get('offset') || '0', 10);
    const lastBlocks = searchParams.get('lastBlocks') ? parseInt(searchParams.get('lastBlocks')!, 10) : null;
    const location = searchParams.get('location');
    const excludeLocations = searchParams.get('excludeLocations')?.split(',').filter(Boolean) || [];
    const excludeRelays = searchParams.get('excludeRelays')?.split(',').filter(Boolean) || [];
    const blockRangeStart = searchParams.get('blockRangeStart') ? parseInt(searchParams.get('blockRangeStart')!, 10) : null;
    const blockRangeEnd = searchParams.get('blockRangeEnd') ? parseInt(searchParams.get('blockRangeEnd')!, 10) : null;
    const dateFrom = searchParams.get('dateFrom');
    const dateTo = searchParams.get('dateTo');

    // Build where clause
    const whereClause: any = {
      origin: { not: null },
      bloxroute_timestamp: { not: null },
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
    // If lastBlocks is specified, get the latest X blocks first
    else if (lastBlocks && lastBlocks > 0) {
      // Get the latest X block numbers with bloxroute data
      const latestBlocks = await prisma.block.findMany({
        where: {
          origin: { not: null },
          bloxroute_timestamp: { not: null },
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

    // Fetch blocks with bloxroute data and relay details
    let blocks = await prisma.block.findMany({
      where: whereClause,
      include: {
        relay_details: {
          orderBy: { arrival_order: 'asc' },
          take: 1, // Only get first relay
        },
      },
      orderBy: { block_number: 'desc' },
      // For exclude relay filter, we fetch more initially and filter in memory
      skip: excludeRelays.length > 0 ? 0 : offset,
      take: excludeRelays.length > 0 ? 10000 : limit, // Fetch more when filtering by relay
    });

    // Filter out blocks with excluded relay names
    if (excludeRelays.length > 0) {
      blocks = blocks.filter(block => {
        const firstRelay = block.relay_details[0];
        return firstRelay && !excludeRelays.includes(firstRelay.relay_name);
      });

      // Apply pagination after filtering
      blocks = blocks.slice(offset, offset + limit);
    }

    // Get total count (accounting for exclude relays if needed)
    let total = await prisma.block.count({
      where: whereClause,
    });

    // If excluding relays, we need to get actual count after filtering
    if (excludeRelays.length > 0) {
      const allFilteredBlocks = await prisma.block.findMany({
        where: whereClause,
        include: {
          relay_details: {
            orderBy: { arrival_order: 'asc' },
            take: 1,
          },
        },
      });
      total = allFilteredBlocks.filter(block => {
        const firstRelay = block.relay_details[0];
        return firstRelay && !excludeRelays.includes(firstRelay.relay_name);
      }).length;
    }

    // Calculate overall statistics respecting filters
    const statsWhereClause: any = { ...whereClause };
    statsWhereClause.is_win_bloxroute = { not: null };
    statsWhereClause.time_difference_ms = { not: null };

    let allBlocksWithComparison: any;

    if (excludeRelays.length > 0) {
      // When we need to filter by relay, we need to include relay_details
      allBlocksWithComparison = await prisma.block.findMany({
        where: statsWhereClause,
        include: {
          relay_details: {
            orderBy: { arrival_order: 'asc' },
            take: 1,
          },
        },
      });

      // Filter out excluded relays from statistics
      allBlocksWithComparison = allBlocksWithComparison.filter((block: any) => {
        const firstRelay = block.relay_details[0];
        return firstRelay && !excludeRelays.includes(firstRelay.relay_name);
      });
    } else {
      // When we don't need relay filtering, just select the fields we need
      allBlocksWithComparison = await prisma.block.findMany({
        where: statsWhereClause,
        select: {
          is_win_bloxroute: true,
          time_difference_ms: true,
        },
      });
    }

    const totalComparisons = allBlocksWithComparison.length;
    const bloxrouteWins = allBlocksWithComparison.filter((b: any) => b.is_win_bloxroute === true).length;
    const relayWins = totalComparisons - bloxrouteWins;
    const avgTimeDiff = totalComparisons > 0
      ? allBlocksWithComparison.reduce((sum: number, b: any) => {
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
