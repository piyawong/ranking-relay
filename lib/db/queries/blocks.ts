import { randomUUID } from 'crypto';
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
      RelayDetail: {
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
      RelayDetail: {
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
        RelayDetail: {
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
    arrival_timestamp: Date;
    ranking_score: number;
  }>,
  origin?: string,
  bloxrouteTimestamp?: Date,
  blockHash?: string
): Promise<BlockWithDetails> {
  // Calculate comparison if we have both bloxroute timestamp and relay details
  let isWinBloxroute: boolean | undefined;
  let timeDifferenceMs: number | undefined;

  if (bloxrouteTimestamp && relayDetails.length > 0) {
    // Get first relay (lowest arrival_order)
    const firstRelay = relayDetails.reduce((prev, current) =>
      prev.arrival_order < current.arrival_order ? prev : current
    );

    const firstRelayTime = new Date(firstRelay.arrival_timestamp).getTime();
    const bloxrouteTime = new Date(bloxrouteTimestamp).getTime();

    // Calculate absolute time difference
    timeDifferenceMs = Math.abs(firstRelayTime - bloxrouteTime);

    // Determine winner with 5ms tolerance for relay
    // Reason: Relay wins if it arrives first OR within 5ms of bloxroute
    // This accounts for network variance and gives relay a fair margin
    const RELAY_WIN_TOLERANCE_MS = 5;
    isWinBloxroute = (bloxrouteTime + RELAY_WIN_TOLERANCE_MS) < firstRelayTime;
  }

  const now = new Date();
  return prisma.block.create({
    data: {
      id: randomUUID(),
      block_number: blockNumber,
      block_hash: blockHash,
      origin: origin,
      bloxroute_timestamp: bloxrouteTimestamp,
      is_win_bloxroute: isWinBloxroute,
      time_difference_ms: timeDifferenceMs,
      updated_at: now,
      RelayDetail: {
        create: relayDetails.map(rd => ({
          id: randomUUID(),
          ...rd
        }))
      }
    },
    include: {
      RelayDetail: true
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