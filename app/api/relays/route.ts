import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db/prisma';
import { calculateRankingScore } from '@/lib/utils/ranking';
import { RelayDataSchema } from '@/lib/utils/validation';
import { createBlock, blockExists } from '@/lib/db/queries/blocks';
import { updateRelayStatistics } from '@/lib/db/queries/statistics';
import { queryBloxroute, getBlockHashFromSlot, queryBloxrouteReceive, getGermanyTimestamp } from '@/lib/utils/fetch-block-data';
import type { ApiResponse, RelayDataResponse } from '@/lib/types/api';

// POST /api/relays - Create new relay data for a block
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    const validated = RelayDataSchema.parse(body);

    // Check if block already exists
    const exists = await blockExists(validated.block_number);
    if (exists) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: 'Block already exists',
        details: { block_number: validated.block_number }
      }, { status: 409 });
    }

    // Calculate ranking scores for each relay
    const relayDetails = validated.relay_details.map((detail, index) => ({
      relay_name: detail.name,
      latency: detail.latency,
      loss: detail.loss,
      arrival_order: index,
      arrival_timestamp: new Date(detail.arrival_timestamp),
      ranking_score: calculateRankingScore(detail, index)
    }));

    // Fetch Bloxroute data for the block (non-blocking)
    let origin: string | undefined;
    let bloxrouteTimestamp: Date | undefined;
    let blockHash: string | undefined;

    try {
      // Try to get block hash from slot number (assume block_number is slot for now)
      // Reason: This runs in parallel and doesn't block block creation
      // deplay 3 seconds
      await new Promise(resolve => setTimeout(resolve, 3000));
      const slotInfo = await getBlockHashFromSlot(validated.block_number);
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
              console.warn(`No Germany timestamp found for block ${validated.block_number}, using general timestamp`);
              if (bloxrouteData.timestamp) {
                const timestampMs = Number(bloxrouteData.timestamp) * 1000;
                bloxrouteTimestamp = new Date(timestampMs);
              }
            }
          } else {
            // Fallback to general timestamp if receipts not available
            console.warn(`No receipts data for block ${validated.block_number}, using general timestamp`);
            if (bloxrouteData.timestamp) {
              const timestampMs = Number(bloxrouteData.timestamp) * 1000;
              bloxrouteTimestamp = new Date(timestampMs);
            }
          }
        }
      }
    } catch (error) {
      // Silently handle Bloxroute fetch errors - block creation should not fail
      console.error('Failed to fetch Bloxroute data:', error);
    }

    // Use block_hash from request if provided, otherwise use from slot lookup
    const finalBlockHash = validated.block_hash || blockHash;

    // Create the block with relay details and optional Bloxroute data
    const block = await createBlock(
      validated.block_number,
      relayDetails,
      origin,
      bloxrouteTimestamp,
      finalBlockHash
    );

    // Update statistics asynchronously (don't wait for it)
    // Note: Statistics are now computed directly from RelayDetail, 
    // but we still update the cache table for consistency
    Promise.all(
      validated.relay_details.map(detail =>
        updateRelayStatistics(detail.name).catch(err =>
          console.error(`Failed to update stats for ${detail.name}:`, err)
        )
      )
    ).catch(err => {
      // Silently handle errors - statistics will be computed on-the-fly anyway
      console.error('Error updating statistics:', err);
    });

    // Return success response
    const response: ApiResponse<RelayDataResponse> = {
      success: true,
      message: 'Relay data recorded successfully',
      data: {
        block_id: block.id,
        rankings: block.relay_details.map(r => ({
          relay_name: r.relay_name,
          ranking_score: parseFloat(r.ranking_score.toString()),
          arrival_order: r.arrival_order
        }))
      }
    };

    return NextResponse.json(response);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: 'Validation error',
        details: error.errors
      }, { status: 400 });
    }

    console.error('Error processing relay data:', error);
    return NextResponse.json<ApiResponse>({
      success: false,
      error: 'Internal server error'
    }, { status: 500 });
  }
}

// GET /api/relays - Get latest relay rankings
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const limit = parseInt(searchParams.get('limit') || '20', 10);
    const offset = parseInt(searchParams.get('offset') || '0', 10);

    const { blocks, total } = await prisma.block.findMany({
      skip: offset,
      take: limit,
      orderBy: { block_number: 'desc' },
      include: {
        relay_details: {
          orderBy: { ranking_score: 'asc' }
        }
      }
    }).then(async blocks => {
      const total = await prisma.block.count();
      return { blocks, total };
    });

    return NextResponse.json<ApiResponse>({
      success: true,
      data: {
        blocks,
        pagination: {
          total,
          limit,
          offset,
          hasMore: offset + limit < total
        }
      }
    });
  } catch (error) {
    console.error('Error fetching relay data:', error);
    return NextResponse.json<ApiResponse>({
      success: false,
      error: 'Internal server error'
    }, { status: 500 });
  }
}

// DELETE /api/relays - Delete all relay and block data
export async function DELETE(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const confirm = searchParams.get('confirm');
    
    // Require explicit confirmation
    if (confirm !== 'true') {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: 'Confirmation required. Add ?confirm=true to the URL'
      }, { status: 400 });
    }

    // Get counts before deletion
    const [blockCount, relayDetailCount, statisticsCount] = await Promise.all([
      prisma.block.count(),
      prisma.relayDetail.count(),
      prisma.relayStatistics.count()
    ]);
    
    // Delete all data (order matters due to foreign keys)
    // RelayDetail has foreign key to Block, so delete it first
    const relayDetailResult = await prisma.relayDetail.deleteMany({});
    const blockResult = await prisma.block.deleteMany({});
    const statisticsResult = await prisma.relayStatistics.deleteMany({});

    return NextResponse.json<ApiResponse>({
      success: true,
      message: `Successfully deleted all relay and block data`,
      data: {
        deletedBlocks: blockResult.count,
        deletedRelayDetails: relayDetailResult.count,
        deletedStatistics: statisticsResult.count,
        previousCounts: {
          blocks: blockCount,
          relayDetails: relayDetailCount,
          statistics: statisticsCount
        }
      }
    });
  } catch (error) {
    console.error('Error deleting relay data:', error);
    return NextResponse.json<ApiResponse>({
      success: false,
      error: 'Internal server error'
    }, { status: 500 });
  }
}