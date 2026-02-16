import { NextRequest, NextResponse } from 'next/server';
import { getBlockByNumber } from '@/lib/db/queries/blocks';
import { decimalToNumber } from '@/lib/utils/format';
import { queryBloxroute, getBlockHashFromSlot, queryBloxrouteReceive, getGermanyTimestamp } from '@/lib/utils/fetch-block-data';
import { prisma } from '@/lib/db/prisma';
import type { ApiResponse, BlockData } from '@/lib/types/api';

// GET /api/relays/[blockNumber] - Get specific block data
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ blockNumber: string }> }
) {
  try {
    const { blockNumber: blockNumberStr } = await params;
    const blockNumber = parseInt(blockNumberStr, 10);

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
      block_hash: block.block_hash || undefined,
      origin: block.origin || undefined,
      bloxroute_timestamp: block.bloxroute_timestamp?.toISOString(),
      created_at: block.created_at.toISOString(),
      updated_at: block.updated_at.toISOString(),
      relay_details: block.RelayDetail.map(detail => ({
        id: detail.id,
        block_id: detail.block_id,
        relay_name: detail.relay_name,
        latency: decimalToNumber(detail.latency),
        loss: decimalToNumber(detail.loss),
        arrival_order: detail.arrival_order,
        arrival_timestamp: detail.arrival_timestamp.toISOString(),
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

// PATCH /api/relays/[blockNumber] - Refresh Bloxroute data for a specific block
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ blockNumber: string }> }
) {
  try {
    const { blockNumber: blockNumberStr } = await params;
    const blockNumber = parseInt(blockNumberStr, 10);

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

    // Fetch Bloxroute data
    let origin: string | undefined;
    let bloxrouteTimestamp: Date | undefined;
    let blockHash: string | undefined;

    try {
      // Try to get block hash from slot number
      const slotInfo = await getBlockHashFromSlot(blockNumber);
      if (slotInfo && slotInfo.executionBlockHash) {
        blockHash = slotInfo.executionBlockHash;
        const bloxrouteData = await queryBloxroute(slotInfo.executionBlockHash);

        if (bloxrouteData) {
          origin = bloxrouteData.origin;

          // Fetch receipts to get Germany-specific timestamp
          // Reason: Use Germany timestamp as canonical bloXroute timestamp for consistent comparisons
          const receiptsData = await queryBloxrouteReceive(slotInfo.executionBlockHash);

          if (receiptsData && receiptsData.blockReceipts) {
            // Extract Germany timestamp from receipts
            const germanyTimestamp = getGermanyTimestamp(receiptsData.blockReceipts);
            bloxrouteTimestamp = germanyTimestamp || undefined;

            if (!bloxrouteTimestamp) {
              // Fallback to general timestamp if Germany node not found
              console.warn(`No Germany timestamp found for block ${blockNumber}, using general timestamp`);
              if (bloxrouteData.timestamp) {
                const timestampMs = Number(bloxrouteData.timestamp) * 1000;
                bloxrouteTimestamp = new Date(timestampMs);
              }
            }
          } else {
            // Fallback to general timestamp if receipts not available
            console.warn(`No receipts data for block ${blockNumber}, using general timestamp`);
            if (bloxrouteData.timestamp) {
              const timestampMs = Number(bloxrouteData.timestamp) * 1000;
              bloxrouteTimestamp = new Date(timestampMs);
            }
          }
        }
      }
    } catch (error) {
      console.error('Failed to fetch Bloxroute data:', error);
      return NextResponse.json<ApiResponse>({
        success: false,
        error: 'Failed to fetch Bloxroute data'
      }, { status: 502 });
    }

    // Update the block with new Bloxroute data
    const updatedBlock = await prisma.block.update({
      where: { id: block.id },
      data: {
        block_hash: blockHash || block.block_hash,
        origin: origin || block.origin,
        bloxroute_timestamp: bloxrouteTimestamp || block.bloxroute_timestamp,
      },
      include: {
        RelayDetail: {
          orderBy: { ranking_score: 'asc' }
        }
      }
    });

    // Transform data for API response
    const blockData: BlockData = {
      id: updatedBlock.id,
      block_number: updatedBlock.block_number,
      block_hash: updatedBlock.block_hash || undefined,
      origin: updatedBlock.origin || undefined,
      bloxroute_timestamp: updatedBlock.bloxroute_timestamp?.toISOString(),
      created_at: updatedBlock.created_at.toISOString(),
      updated_at: updatedBlock.updated_at.toISOString(),
      relay_details: updatedBlock.RelayDetail.map(detail => ({
        id: detail.id,
        block_id: detail.block_id,
        relay_name: detail.relay_name,
        latency: decimalToNumber(detail.latency),
        loss: decimalToNumber(detail.loss),
        arrival_order: detail.arrival_order,
        arrival_timestamp: detail.arrival_timestamp.toISOString(),
        ranking_score: decimalToNumber(detail.ranking_score),
        created_at: detail.created_at.toISOString()
      }))
    };

    return NextResponse.json<ApiResponse<BlockData>>({
      success: true,
      message: 'Bloxroute data refreshed successfully',
      data: blockData
    });
  } catch (error) {
    console.error('Error refreshing Bloxroute data:', error);
    return NextResponse.json<ApiResponse>({
      success: false,
      error: 'Internal server error'
    }, { status: 500 });
  }
}