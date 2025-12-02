import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { Prisma } from '@prisma/client';
import type { ApiResponse } from '@/lib/types/api';

// GET /api/bloxroute/origins - Get origin statistics from all blocks (OPTIMIZED with SQL aggregation)
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

    // Build WHERE conditions
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
    let blockNumbers: number[] | undefined;
    if (lastBlocks && lastBlocks > 0 && blockRangeStart === null) {
      const latestBlocks = await prisma.$queryRaw<{ block_number: number }[]>`
        SELECT block_number FROM "Block"
        WHERE origin IS NOT NULL
          AND bloxroute_timestamp IS NOT NULL
          AND is_win_bloxroute IS NOT NULL
        ORDER BY block_number DESC
        LIMIT ${lastBlocks}
      `;
      blockNumbers = latestBlocks.map(b => b.block_number);
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

    // Build relay exclusion
    const relayJoin = excludeRelays.length > 0
      ? Prisma.sql`
          INNER JOIN LATERAL (
            SELECT relay_name FROM "RelayDetail" rd
            WHERE rd.block_id = b.id
            ORDER BY rd.arrival_order ASC
            LIMIT 1
          ) first_relay ON first_relay.relay_name NOT IN (${Prisma.join(excludeRelays)})
        `
      : Prisma.sql``;

    const whereClause = Prisma.sql`WHERE ${Prisma.join(conditions, ' AND ')}`;

    // Use SQL GROUP BY for aggregation - much faster than fetching all records
    const [originStats, totalBlocks] = await Promise.all([
      prisma.$queryRaw<{
        origin: string;
        count: bigint;
        relay_wins: bigint;
        bloxroute_wins: bigint;
      }[]>`
        SELECT
          b.origin,
          COUNT(*)::bigint as count,
          COUNT(*) FILTER (WHERE b.is_win_bloxroute = false)::bigint as relay_wins,
          COUNT(*) FILTER (WHERE b.is_win_bloxroute = true)::bigint as bloxroute_wins
        FROM "Block" b
        ${relayJoin}
        ${whereClause}
        GROUP BY b.origin
        ORDER BY count DESC
      `,

      prisma.$queryRaw<{ total: bigint }[]>`
        SELECT COUNT(*)::bigint as total
        FROM "Block" b
        ${relayJoin}
        ${whereClause}
      `,
    ]);

    const total = Number(totalBlocks[0]?.total || 0);

    // Map results
    const origins = originStats.map(stat => {
      const count = Number(stat.count);
      const relayWins = Number(stat.relay_wins);
      const bloxrouteWins = Number(stat.bloxroute_wins);
      const statTotal = relayWins + bloxrouteWins;

      return {
        origin: stat.origin,
        count,
        percentage: total > 0 ? (count / total) * 100 : 0,
        relay_wins: relayWins,
        bloxroute_wins: bloxrouteWins,
        relay_win_percentage: statTotal > 0 ? (relayWins / statTotal) * 100 : 0,
        bloxroute_win_percentage: statTotal > 0 ? (bloxrouteWins / statTotal) * 100 : 0,
      };
    });

    return NextResponse.json<ApiResponse>({
      success: true,
      data: {
        total_blocks: total,
        unique_origins: origins.length,
        origins,
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
