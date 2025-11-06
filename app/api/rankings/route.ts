import { NextRequest, NextResponse } from 'next/server';
import { RankingQuerySchema } from '@/lib/utils/validation';
import { decimalToNumber } from '@/lib/utils/format';
import { prisma } from '@/lib/db/prisma';
import type { ApiResponse, PaginatedResponse } from '@/lib/types/api';

// GET /api/rankings - Get current rankings
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const params = Object.fromEntries(searchParams.entries());

    const query = RankingQuerySchema.parse(params);

    // Build query conditions
    const where: Record<string, unknown> = {};
    if (query.relayName) {
      where.relay_name = query.relayName;
    }
    if (query.blockNumber) {
      const block = await prisma.block.findUnique({
        where: { block_number: query.blockNumber },
        select: { id: true }
      });
      if (block) {
        where.block_id = block.id;
      }
    }

    // Get rankings with pagination
    const [rankings, total] = await Promise.all([
      prisma.relayDetail.findMany({
        where,
        skip: query.offset,
        take: query.limit,
        orderBy: { ranking_score: 'asc' },
        include: {
          block: {
            select: {
              block_number: true,
              created_at: true
            }
          }
        }
      }),
      prisma.relayDetail.count({ where })
    ]);

    // Transform the data
    const transformedRankings = rankings.map(ranking => ({
      id: ranking.id,
      relay_name: ranking.relay_name,
      latency: decimalToNumber(ranking.latency),
      loss: decimalToNumber(ranking.loss),
      arrival_order: ranking.arrival_order,
      ranking_score: decimalToNumber(ranking.ranking_score),
      block_number: ranking.block.block_number,
      created_at: ranking.created_at.toISOString()
    }));

    const response: ApiResponse<PaginatedResponse<typeof transformedRankings[0]>> = {
      success: true,
      data: {
        data: transformedRankings,
        pagination: {
          total,
          limit: query.limit,
          offset: query.offset,
          hasMore: query.offset + query.limit < total
        }
      }
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Error fetching rankings:', error);
    return NextResponse.json<ApiResponse>({
      success: false,
      error: 'Internal server error'
    }, { status: 500 });
  }
}