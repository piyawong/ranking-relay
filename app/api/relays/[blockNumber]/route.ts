import { NextRequest, NextResponse } from 'next/server';
import { getBlockByNumber } from '@/lib/db/queries/blocks';
import { decimalToNumber } from '@/lib/utils/format';
import type { ApiResponse, BlockData } from '@/lib/types/api';

// GET /api/relays/[blockNumber] - Get specific block data
export async function GET(
  request: NextRequest,
  { params }: { params: { blockNumber: string } }
) {
  try {
    const blockNumber = parseInt(params.blockNumber, 10);

    if (isNaN(blockNumber) || blockNumber <= 0) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: 'Invalid block number'
      }, { status: 400 });
    }

    const block = await getBlockByNumber(blockNumber);

    if (!block) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: 'Block not found'
      }, { status: 404 });
    }

    // Transform data for API response
    const blockData: BlockData = {
      id: block.id,
      block_number: block.block_number,
      created_at: block.created_at.toISOString(),
      updated_at: block.updated_at.toISOString(),
      relay_details: block.relay_details.map(detail => ({
        id: detail.id,
        block_id: detail.block_id,
        relay_name: detail.relay_name,
        latency: decimalToNumber(detail.latency),
        loss: decimalToNumber(detail.loss),
        arrival_order: detail.arrival_order,
        ranking_score: decimalToNumber(detail.ranking_score),
        created_at: detail.created_at.toISOString()
      }))
    };

    return NextResponse.json<ApiResponse<BlockData>>({
      success: true,
      data: blockData
    });
  } catch (error) {
    console.error('Error fetching block data:', error);
    return NextResponse.json<ApiResponse>({
      success: false,
      error: 'Internal server error'
    }, { status: 500 });
  }
}