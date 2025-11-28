import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import type { ApiResponse } from '@/lib/types/api';

// DELETE /api/bloxroute/high-diff/delete - Remove Bloxroute data from a specific block
export async function DELETE(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const blockNumber = searchParams.get('blockNumber');

    if (!blockNumber) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: 'Block number is required'
      }, { status: 400 });
    }

    const blockNum = parseInt(blockNumber, 10);

    // Find and update the block to remove Bloxroute comparison data
    const block = await prisma.block.findFirst({
      where: { block_number: blockNum }
    });

    if (!block) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: 'Block not found'
      }, { status: 404 });
    }

    // Clear the Bloxroute comparison fields
    const updatedBlock = await prisma.block.update({
      where: { id: block.id },
      data: {
        origin: null,
        bloxroute_timestamp: null,
        is_win_bloxroute: null,
        time_difference_ms: null
      }
    });

    return NextResponse.json<ApiResponse>({
      success: true,
      message: `Removed Bloxroute data from block ${blockNum}`,
      data: {
        block_number: blockNum,
        block_id: updatedBlock.id
      }
    });

  } catch (error) {
    console.error('Error removing high-diff block:', error);
    return NextResponse.json<ApiResponse>({
      success: false,
      error: 'Internal server error'
    }, { status: 500 });
  }
}