import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { Prisma } from '@prisma/client';
import type { ApiResponse } from '@/lib/types/api';

// Helper to build SQL WHERE conditions
function buildWhereConditions(params: {
  location?: string | null;
  excludeLocations: string[];
  blockRangeStart?: number | null;
  blockRangeEnd?: number | null;
  dateFrom?: string | null;
  dateTo?: string | null;
  blockNumbers?: number[];
  requireComparison?: boolean;
}): Prisma.Sql[] {
  const conditions: Prisma.Sql[] = [
    Prisma.sql`b.origin IS NOT NULL`,
    Prisma.sql`b.bloxroute_timestamp IS NOT NULL`,
  ];

  if (params.requireComparison) {
    conditions.push(Prisma.sql`b.is_win_bloxroute IS NOT NULL`);
    conditions.push(Prisma.sql`b.time_difference_ms IS NOT NULL`);
  }

  if (params.location && params.location !== 'all') {
    conditions.push(Prisma.sql`b.origin = ${params.location}`);
  }

  if (params.excludeLocations.length > 0) {
    conditions.push(Prisma.sql`b.origin NOT IN (${Prisma.join(params.excludeLocations)})`);
  }

  if (params.blockRangeStart !== null && params.blockRangeStart !== undefined &&
      params.blockRangeEnd !== null && params.blockRangeEnd !== undefined) {
    conditions.push(Prisma.sql`b.block_number >= ${params.blockRangeStart}`);
    conditions.push(Prisma.sql`b.block_number <= ${params.blockRangeEnd}`);
  }

  if (params.blockNumbers && params.blockNumbers.length > 0) {
    conditions.push(Prisma.sql`b.block_number IN (${Prisma.join(params.blockNumbers)})`);
  }

  if (params.dateFrom) {
    conditions.push(Prisma.sql`b.created_at >= ${new Date(params.dateFrom)}`);
  }

  if (params.dateTo) {
    const endDate = new Date(params.dateTo);
    endDate.setDate(endDate.getDate() + 1);
    conditions.push(Prisma.sql`b.created_at <= ${endDate}`);
  }

  return conditions;
}

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

    // If lastBlocks is specified, get the block numbers first
    let blockNumbers: number[] | undefined;
    if (lastBlocks && lastBlocks > 0 && blockRangeStart === null) {
      const latestBlocks = await prisma.$queryRaw<{ block_number: number }[]>`
        SELECT block_number FROM "Block"
        WHERE origin IS NOT NULL AND bloxroute_timestamp IS NOT NULL
        ORDER BY block_number DESC
        LIMIT ${lastBlocks}
      `;
      blockNumbers = latestBlocks.map(b => b.block_number);
    }

    // Build common WHERE conditions
    const baseConditions = buildWhereConditions({
      location,
      excludeLocations,
      blockRangeStart,
      blockRangeEnd,
      dateFrom,
      dateTo,
      blockNumbers,
    });

    // Build relay exclusion condition
    const relayExclusionJoin = excludeRelays.length > 0
      ? Prisma.sql`
          INNER JOIN LATERAL (
            SELECT relay_name FROM "RelayDetail" rd
            WHERE rd.block_id = b.id
            ORDER BY rd.arrival_order ASC
            LIMIT 1
          ) first_relay ON true
        `
      : Prisma.sql`
          LEFT JOIN LATERAL (
            SELECT relay_name, arrival_timestamp FROM "RelayDetail" rd
            WHERE rd.block_id = b.id
            ORDER BY rd.arrival_order ASC
            LIMIT 1
          ) first_relay ON true
        `;

    const relayExclusionCondition = excludeRelays.length > 0
      ? Prisma.sql`AND first_relay.relay_name NOT IN (${Prisma.join(excludeRelays)})`
      : Prisma.sql``;

    // Run statistics and data queries in parallel
    const whereClause = Prisma.sql`WHERE ${Prisma.join(baseConditions, ' AND ')} ${relayExclusionCondition}`;

    // Statistics query using SQL aggregation (much faster than fetching all records)
    const statsConditions = buildWhereConditions({
      location,
      excludeLocations,
      blockRangeStart,
      blockRangeEnd,
      dateFrom,
      dateTo,
      blockNumbers,
      requireComparison: true,
    });
    const statsWhereClause = Prisma.sql`WHERE ${Prisma.join(statsConditions, ' AND ')} ${relayExclusionCondition}`;

    const [stats, comparisons, totalCount] = await Promise.all([
      // Statistics using SQL aggregation
      prisma.$queryRaw<{
        total: bigint;
        bloxroute_wins: bigint;
        relay_wins: bigint;
        avg_time_diff: number | null;
      }[]>`
        SELECT
          COUNT(*)::bigint as total,
          COUNT(*) FILTER (WHERE b.is_win_bloxroute = true)::bigint as bloxroute_wins,
          COUNT(*) FILTER (WHERE b.is_win_bloxroute = false)::bigint as relay_wins,
          AVG(
            CASE
              WHEN b.is_win_bloxroute = true THEN b.time_difference_ms
              ELSE -b.time_difference_ms
            END
          ) as avg_time_diff
        FROM "Block" b
        ${relayExclusionJoin}
        ${statsWhereClause}
      `,

      // Paginated comparisons data
      prisma.$queryRaw<{
        block_number: number;
        block_hash: string | null;
        origin: string;
        bloxroute_timestamp: Date;
        is_win_bloxroute: boolean;
        time_difference_ms: number;
        created_at: Date;
        first_relay_name: string;
        first_relay_timestamp: Date;
      }[]>`
        SELECT
          b.block_number,
          b.block_hash,
          b.origin,
          b.bloxroute_timestamp,
          b.is_win_bloxroute,
          b.time_difference_ms,
          b.created_at,
          first_relay.relay_name as first_relay_name,
          first_relay.arrival_timestamp as first_relay_timestamp
        FROM "Block" b
        ${relayExclusionJoin}
        ${whereClause}
          AND b.is_win_bloxroute IS NOT NULL
        ORDER BY b.block_number DESC
        LIMIT ${limit}
        OFFSET ${offset}
      `,

      // Total count for pagination
      prisma.$queryRaw<{ count: bigint }[]>`
        SELECT COUNT(*)::bigint as count
        FROM "Block" b
        ${relayExclusionJoin}
        ${whereClause}
      `,
    ]);

    const statistics = stats[0] || { total: BigInt(0), bloxroute_wins: BigInt(0), relay_wins: BigInt(0), avg_time_diff: null };
    const total = Number(totalCount[0]?.count || 0);

    // Map comparison data
    const mappedComparisons = comparisons.map(block => {
      const relayWon = !block.is_win_bloxroute;
      const timeDiff = block.time_difference_ms || 0;

      return {
        block_number: block.block_number,
        block_hash: block.block_hash,
        first_relay_name: block.first_relay_name,
        first_relay_timestamp: block.first_relay_timestamp.toISOString(),
        bloxroute_origin: block.origin,
        bloxroute_timestamp: block.bloxroute_timestamp.toISOString(),
        relay_won: relayWon,
        time_difference_ms: relayWon ? -timeDiff : timeDiff,
        created_at: block.created_at.toISOString(),
      };
    });

    const totalComparisons = Number(statistics.total);
    const relayWins = Number(statistics.relay_wins);
    const bloxrouteWins = Number(statistics.bloxroute_wins);

    return NextResponse.json<ApiResponse>({
      success: true,
      data: {
        comparisons: mappedComparisons,
        statistics: {
          total: totalComparisons,
          relay_wins: relayWins,
          bloxroute_wins: bloxrouteWins,
          relay_win_rate: totalComparisons > 0 ? (relayWins / totalComparisons) * 100 : 0,
          avg_time_difference_ms: statistics.avg_time_diff || 0,
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
