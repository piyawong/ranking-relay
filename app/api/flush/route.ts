import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import type { ApiResponse } from '@/lib/types/api';

// DELETE /api/flush - Flush all block data
export async function DELETE(_request: NextRequest) {
  try {
    // Delete all data in cascade order
    await prisma.relayDetail.deleteMany({});
    await prisma.block.deleteMany({});
    await prisma.relayStatistics.deleteMany({});

    return NextResponse.json<ApiResponse>({
      success: true,
      data: {
        message: 'All block data has been flushed successfully',
      },
    });
  } catch (error) {
    console.error('Error flushing data:', error);
    return NextResponse.json<ApiResponse>({
      success: false,
      error: 'Failed to flush data',
    }, { status: 500 });
  }
}
