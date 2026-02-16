import { prisma } from '../prisma';
import type { RelayDetail } from '@prisma/client';

/**
 * Get relay rankings for the latest block
 */
export async function getLatestRankings(limit: number = 20): Promise<RelayDetail[]> {
  const latestBlock = await prisma.block.findFirst({
    orderBy: { block_number: 'desc' },
    include: {
      RelayDetail: {
        orderBy: { ranking_score: 'asc' },
        take: limit
      }
    }
  });

  return latestBlock?.RelayDetail || [];
}

/**
 * Get relay details by relay name with pagination
 */
export async function getRelayHistory(
  relayName: string,
  limit: number = 50,
  offset: number = 0
): Promise<{ details: RelayDetail[]; total: number }> {
  const [details, total] = await Promise.all([
    prisma.relayDetail.findMany({
      where: { relay_name: relayName },
      skip: offset,
      take: limit,
      orderBy: { created_at: 'desc' },
      include: {
        Block: true
      }
    }),
    prisma.relayDetail.count({
      where: { relay_name: relayName }
    })
  ]);

  return { details, total };
}

/**
 * Get top performing relays by average ranking score
 */
export async function getTopRelays(limit: number = 10) {
  const result = await prisma.$queryRaw`
    SELECT
      relay_name,
      COUNT(*) as total_blocks,
      AVG(ranking_score::numeric) as avg_score,
      AVG(latency::numeric) as avg_latency,
      AVG(loss::numeric) as avg_loss,
      MIN(ranking_score::numeric) as best_score,
      SUM(CASE WHEN arrival_order = 0 THEN 1 ELSE 0 END) as first_arrivals
    FROM "RelayDetail"
    GROUP BY relay_name
    ORDER BY avg_score ASC
    LIMIT ${limit}
  `;

  return result;
}

/**
 * Get relay performance comparison for a specific block
 */
export async function getBlockRelayComparison(
  blockNumber: number
): Promise<RelayDetail[]> {
  const block = await prisma.block.findUnique({
    where: { block_number: blockNumber },
    include: {
      RelayDetail: {
        orderBy: { ranking_score: 'asc' }
      }
    }
  });

  return block?.RelayDetail || [];
}

/**
 * Get unique relay names
 */
export async function getUniqueRelayNames(): Promise<string[]> {
  const relays = await prisma.relayDetail.findMany({
    select: { relay_name: true },
    distinct: ['relay_name'],
    orderBy: { relay_name: 'asc' }
  });

  return relays.map(r => r.relay_name);
}