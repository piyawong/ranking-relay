import { prisma } from '../prisma';
import type { BlockWithDetails } from '@/lib/types/database';

/**
 * Get a block by block number with all relay details
 */
export async function getBlockByNumber(
  blockNumber: number
): Promise<BlockWithDetails | null> {
  return prisma.block.findUnique({
    where: { block_number: blockNumber },
    include: {
      relay_details: {
        orderBy: { ranking_score: 'asc' }
      }
    }
  });
}

/**
 * Get a block by ID with all relay details
 */
export async function getBlockById(
  id: string
): Promise<BlockWithDetails | null> {
  return prisma.block.findUnique({
    where: { id },
    include: {
      relay_details: {
        orderBy: { ranking_score: 'asc' }
      }
    }
  });
}

/**
 * Get latest blocks with pagination
 */
export async function getLatestBlocks(
  limit: number = 10,
  offset: number = 0
): Promise<{ blocks: BlockWithDetails[]; total: number }> {
  const [blocks, total] = await Promise.all([
    prisma.block.findMany({
      skip: offset,
      take: limit,
      orderBy: { block_number: 'desc' },
      include: {
        relay_details: {
          orderBy: { ranking_score: 'asc' }
        }
      }
    }),
    prisma.block.count()
  ]);

  return { blocks, total };
}

/**
 * Create a new block with relay details
 */
export async function createBlock(
  blockNumber: number,
  relayDetails: Array<{
    relay_name: string;
    latency: number;
    loss: number;
    arrival_order: number;
    ranking_score: number;
  }>
): Promise<BlockWithDetails> {
  return prisma.block.create({
    data: {
      block_number: blockNumber,
      relay_details: {
        create: relayDetails
      }
    },
    include: {
      relay_details: true
    }
  });
}

/**
 * Check if a block exists
 */
export async function blockExists(blockNumber: number): Promise<boolean> {
  const count = await prisma.block.count({
    where: { block_number: blockNumber }
  });
  return count > 0;
}

/**
 * Get block count within a date range
 */
export async function getBlockCountByDateRange(
  startDate: Date,
  endDate: Date
): Promise<number> {
  return prisma.block.count({
    where: {
      created_at: {
        gte: startDate,
        lte: endDate
      }
    }
  });
}