import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import type { ApiResponse } from '@/lib/types/api';

/**
 * GET /api/bloxroute/high-diff - Get all blocks with time_difference_ms > 300
 */
export async function GET(_request: NextRequest) {
  try {
    // Get all blocks where time_difference_ms is greater than 300
    const highDiffBlocks = await prisma.block.findMany({
      where: {
        time_difference_ms: { gt: 300 },
        bloxroute_timestamp: { not: null },
        origin: { not: null },
      },
      select: {
        block_number: true,
        time_difference_ms: true,
      },
      orderBy: {
        time_difference_ms: 'desc'
      }
    });

    const blockNumbers = highDiffBlocks.map(block => block.block_number);

    return NextResponse.json<ApiResponse<{ blockNumbers: number[]; count: number; blocks: typeof highDiffBlocks }>>({
      success: true,
      data: {
        blockNumbers,
        count: blockNumbers.length,
        blocks: highDiffBlocks
      }
    });
  } catch (error) {
    console.error('Error fetching high diff blocks:', error);
    return NextResponse.json<ApiResponse>({
      success: false,
      error: 'Internal server error'
    }, { status: 500 });
  }
}
