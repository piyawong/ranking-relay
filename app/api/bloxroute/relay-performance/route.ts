import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import type { ApiResponse } from '@/lib/types/api';

// GET /api/bloxroute/relay-performance - Get win rate statistics per relay
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
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
    // If lastBlocks is specified, get the latest X blocks first
    else if (lastBlocks && lastBlocks > 0) {
      // Get the latest X block numbers with bloxroute data
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

    // Fetch all blocks with their first relay detail
    const blocks = await prisma.block.findMany({
      where: whereClause,
      include: {
        relay_details: {
          orderBy: { arrival_order: 'asc' },
          take: 1, // Only get first relay
        },
      },
    });

    // Aggregate data by relay name
    const relayStats: {
      [key: string]: {
        totalBlocks: number;
        relayWins: number;
        bloxrouteWins: number;
      }
    } = {};

    blocks.forEach(block => {
      const firstRelay = block.relay_details[0];
      if (!firstRelay || block.is_win_bloxroute === null) return;

      const relayName = firstRelay.relay_name;

      // Skip excluded relays
      if (excludeRelays.includes(relayName)) return;

      if (!relayStats[relayName]) {
        relayStats[relayName] = {
          totalBlocks: 0,
          relayWins: 0,
          bloxrouteWins: 0,
        };
      }

      relayStats[relayName].totalBlocks++;

      if (block.is_win_bloxroute) {
        relayStats[relayName].bloxrouteWins++;
      } else {
        relayStats[relayName].relayWins++;
      }
    });

    // Convert to array and calculate percentages
    const relayPerformance = Object.entries(relayStats).map(([relayName, stats]) => ({
      relay_name: relayName,
      total_blocks: stats.totalBlocks,
      relay_wins: stats.relayWins,
      bloxroute_wins: stats.bloxrouteWins,
      relay_win_rate: stats.totalBlocks > 0 ? (stats.relayWins / stats.totalBlocks) * 100 : 0,
      bloxroute_win_rate: stats.totalBlocks > 0 ? (stats.bloxrouteWins / stats.totalBlocks) * 100 : 0,
    })).sort((a, b) => b.relay_win_rate - a.relay_win_rate); // Sort by relay win rate descending

    return NextResponse.json<ApiResponse>({
      success: true,
      data: {
        total_relays: relayPerformance.length,
        relays: relayPerformance,
      },
    });
  } catch (error) {
    console.error('Error fetching relay performance:', error);
    return NextResponse.json<ApiResponse>({
      success: false,
      error: 'Internal server error',
    }, { status: 500 });
  }
}
