import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db/prisma';
import { calculateRankingScore } from '@/lib/utils/ranking';
import { RelayDataSchema } from '@/lib/utils/validation';
import { createBlock, blockExists } from '@/lib/db/queries/blocks';
import { updateRelayStatistics } from '@/lib/db/queries/statistics';
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
      ranking_score: calculateRankingScore(detail, index)
    }));

    // Create the block with relay details
    const block = await createBlock(validated.block_number, relayDetails);

    // Update statistics asynchronously (don't wait for it)
    Promise.all(
      validated.relay_details.map(detail =>
        updateRelayStatistics(detail.name).catch(err =>
          console.error(`Failed to update stats for ${detail.name}:`, err)
        )
      )
    );

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