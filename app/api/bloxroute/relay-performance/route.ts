import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { Prisma } from '@prisma/client';
import type { ApiResponse } from '@/lib/types/api';

// GET /api/bloxroute/relay-performance - Get win rate statistics per relay (OPTIMIZED with SQL aggregation)
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

    // Build WHERE conditions for Block table
    const conditions: Prisma.Sql[] = [
      Prisma.sql`b.origin IS NOT NULL`,
      Prisma.sql`b.bloxroute_timestamp IS NOT NULL`,
      Prisma.sql`b.is_win_bloxroute IS NOT NULL`,
    ];

    if (location && location !== 'all') {
      conditions.push(Prisma.sql`b.origin = ${location}`);
    }

    if (excludeLocations.length > 0) {
      conditions.push(Prisma.sql`b.origin NOT IN (${Prisma.join(excludeLocations)})`);
    }

    if (blockRangeStart !== null && blockRangeEnd !== null) {
      conditions.push(Prisma.sql`b.block_number >= ${blockRangeStart}`);
      conditions.push(Prisma.sql`b.block_number <= ${blockRangeEnd}`);
    }

    // Handle lastBlocks filter
    if (lastBlocks && lastBlocks > 0 && blockRangeStart === null) {
      const latestBlocks = await prisma.$queryRaw<{ block_number: number }[]>`
        SELECT block_number FROM "Block"
        WHERE origin IS NOT NULL
          AND bloxroute_timestamp IS NOT NULL
          AND is_win_bloxroute IS NOT NULL
        ORDER BY block_number DESC
        LIMIT ${lastBlocks}
      `;
      const blockNumbers = latestBlocks.map(b => b.block_number);
      if (blockNumbers.length > 0) {
        conditions.push(Prisma.sql`b.block_number IN (${Prisma.join(blockNumbers)})`);
      }
    }

    if (dateFrom) {
      conditions.push(Prisma.sql`b.created_at >= ${new Date(dateFrom)}`);
    }

    if (dateTo) {
      const endDate = new Date(dateTo);
      endDate.setDate(endDate.getDate() + 1);
      conditions.push(Prisma.sql`b.created_at <= ${endDate}`);
    }

    // Build relay exclusion condition
    const relayExclusionCondition = excludeRelays.length > 0
      ? Prisma.sql`AND first_relay.relay_name NOT IN (${Prisma.join(excludeRelays)})`
      : Prisma.sql``;

    const whereClause = Prisma.sql`WHERE ${Prisma.join(conditions, ' AND ')}`;

    // Use SQL aggregation with GROUP BY - much faster than fetching all records
    const relayStats = await prisma.$queryRaw<{
      relay_name: string;
      total_blocks: bigint;
      relay_wins: bigint;
      bloxroute_wins: bigint;
    }[]>`
      SELECT
        first_relay.relay_name,
        COUNT(*)::bigint as total_blocks,
        COUNT(*) FILTER (WHERE b.is_win_bloxroute = false)::bigint as relay_wins,
        COUNT(*) FILTER (WHERE b.is_win_bloxroute = true)::bigint as bloxroute_wins
      FROM "Block" b
      INNER JOIN LATERAL (
        SELECT relay_name FROM "RelayDetail" rd
        WHERE rd.block_id = b.id
        ORDER BY rd.arrival_order ASC
        LIMIT 1
      ) first_relay ON true
      ${whereClause}
      ${relayExclusionCondition}
      GROUP BY first_relay.relay_name
      ORDER BY COUNT(*) FILTER (WHERE b.is_win_bloxroute = false)::float / NULLIF(COUNT(*), 0) DESC
    `;

    // Map results
    const relayPerformance = relayStats.map(stat => {
      const totalBlocks = Number(stat.total_blocks);
      const relayWins = Number(stat.relay_wins);
      const bloxrouteWins = Number(stat.bloxroute_wins);

      return {
        relay_name: stat.relay_name,
        total_blocks: totalBlocks,
        relay_wins: relayWins,
        bloxroute_wins: bloxrouteWins,
        relay_win_rate: totalBlocks > 0 ? (relayWins / totalBlocks) * 100 : 0,
        bloxroute_win_rate: totalBlocks > 0 ? (bloxrouteWins / totalBlocks) * 100 : 0,
      };
    });

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
