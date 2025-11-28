import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import type { ApiResponse } from '@/lib/types/api';

/**
 * GET /api/bloxroute/missing - Get all blocks that don't have bloxroute data
 */
export async function GET(_request: NextRequest) {
  try {
    // Get all blocks where bloxroute_timestamp is null or origin is null
    const blocksWithoutBloxroute = await prisma.block.findMany({
      where: {
        OR: [
          { bloxroute_timestamp: null },
          { origin: null }
        ]
      },
      select: {
        block_number: true,
      },
      orderBy: {
        block_number: 'desc'
      }
    });

    const blockNumbers = blocksWithoutBloxroute.map(block => block.block_number);

    return NextResponse.json<ApiResponse<{ blockNumbers: number[]; count: number }>>({
      success: true,
      data: {
        blockNumbers,
        count: blockNumbers.length
      }
    });
  } catch (error) {
    console.error('Error fetching blocks without bloxroute data:', error);
    return NextResponse.json<ApiResponse>({
      success: false,
      error: 'Internal server error'
    }, { status: 500 });
  }
}
