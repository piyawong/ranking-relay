import { prisma } from '../prisma';
import type { RelayStatistics } from '@prisma/client';
import { decimalToNumber } from '@/lib/utils/format';

/**
 * Helper function to calculate time cutoff based on timeRange
 */
function getTimeCutoff(timeRange?: string): Date | null {
  if (!timeRange || timeRange === 'all') return null;

  const now = new Date();
  const cutoffs: Record<string, number> = {
    '1h': 60 * 60 * 1000,
    '6h': 6 * 60 * 60 * 1000,
    '24h': 24 * 60 * 60 * 1000,
    '7d': 7 * 24 * 60 * 60 * 1000,
    '30d': 30 * 24 * 60 * 60 * 1000
  };

  const offset = cutoffs[timeRange];
  return offset ? new Date(now.getTime() - offset) : null;
}

interface StatisticsFilters {
  timeRange?: string;
  blockRange?: number;
}

/**
 * Get all relay statistics
 * Computes statistics directly from RelayDetail to ensure all relays are included
 */
export async function getAllStatistics(filters?: StatisticsFilters): Promise<RelayStatistics[]> {
  const timeCutoff = getTimeCutoff(filters?.timeRange);
  const blockRange = filters?.blockRange;

  // Build WHERE conditions for filtering
  let whereConditions = '';
  const params: any[] = [];

  if (timeCutoff) {
    whereConditions = `WHERE rd.created_at >= $1`;
    params.push(timeCutoff);
  }

  if (blockRange) {
    // Get the latest block number and filter for last N blocks
    const latestBlock = await prisma.block.findFirst({
      orderBy: { block_number: 'desc' },
      select: { block_number: true }
    });

    if (latestBlock) {
      const minBlockNumber = Math.max(0, latestBlock.block_number - blockRange);
      if (whereConditions) {
        whereConditions += ` AND b.block_number >= $${params.length + 1}`;
      } else {
        whereConditions = `WHERE b.block_number >= $1`;
      }
      params.push(minBlockNumber);
    }
  }

  // Compute statistics directly from RelayDetail to ensure all relays are included
  const query = `
    SELECT
      rd.relay_name,
      COUNT(*)::int as total_blocks,
      AVG(rd.latency::numeric)::decimal(10,2) as avg_latency,
      AVG(rd.loss::numeric)::decimal(5,2) as avg_loss,
      SUM(CASE WHEN rd.arrival_order = 0 THEN 1 ELSE 0 END)::int as first_arrival_count
    FROM "RelayDetail" rd
    ${blockRange ? 'JOIN "Block" b ON rd.block_id = b.id' : ''}
    ${whereConditions}
    GROUP BY rd.relay_name
    ORDER BY first_arrival_count DESC, avg_latency ASC
  `;

  const relayStats = await prisma.$queryRawUnsafe(query, ...params) as Array<{
    relay_name: string;
    total_blocks: number;
    avg_latency: any; // Decimal type from Prisma
    avg_loss: any; // Decimal type from Prisma
    first_arrival_count: number;
  }>;

  // Transform to match RelayStatistics format
  // Note: We use a placeholder UUID since we're computing on-the-fly
  // The id field is only used for display purposes in the API response
  return relayStats.map(stat => ({
    id: `placeholder-${stat.relay_name}`, // Placeholder ID for compatibility
    relay_name: stat.relay_name,
    total_blocks: stat.total_blocks,
    avg_latency: stat.avg_latency,
    avg_loss: stat.avg_loss,
    first_arrival_count: stat.first_arrival_count,
    last_updated: new Date()
  })) as RelayStatistics[];
}

/**
 * Get statistics for a specific relay
 */
export async function getRelayStatistics(
  relayName: string
): Promise<RelayStatistics | null> {
  return prisma.relayStatistics.findUnique({
    where: { relay_name: relayName }
  });
}

/**
 * Update or create relay statistics
 */
export async function updateRelayStatistics(
  relayName: string
): Promise<RelayStatistics> {
  const relayDetails = await prisma.relayDetail.findMany({
    where: { relay_name: relayName }
  });

  if (relayDetails.length === 0) {
    throw new Error(`No data found for relay: ${relayName}`);
  }

  const totalBlocks = relayDetails.length;
  const avgLatency = relayDetails.reduce(
    (sum, r) => sum + decimalToNumber(r.latency),
    0
  ) / totalBlocks;
  const avgLoss = relayDetails.reduce(
    (sum, r) => sum + decimalToNumber(r.loss),
    0
  ) / totalBlocks;
  const firstArrivalCount = relayDetails.filter(r => r.arrival_order === 0).length;

  return prisma.relayStatistics.upsert({
    where: { relay_name: relayName },
    update: {
      total_blocks: totalBlocks,
      avg_latency: avgLatency,
      avg_loss: avgLoss,
      first_arrival_count: firstArrivalCount
    },
    create: {
      relay_name: relayName,
      total_blocks: totalBlocks,
      avg_latency: avgLatency,
      avg_loss: avgLoss,
      first_arrival_count: firstArrivalCount
    }
  });
}

/**
 * Update all relay statistics
 */
export async function updateAllStatistics(): Promise<void> {
  const relayNames = await prisma.relayDetail.findMany({
    select: { relay_name: true },
    distinct: ['relay_name']
  });

  for (const { relay_name } of relayNames) {
    await updateRelayStatistics(relay_name);
  }
}

/**
 * Get performance summary statistics
 */
export async function getPerformanceSummary(filters?: StatisticsFilters) {
  const timeCutoff = getTimeCutoff(filters?.timeRange);
  const blockRange = filters?.blockRange;

  // Build WHERE conditions
  const whereClause: any = {};
  if (timeCutoff) {
    whereClause.created_at = { gte: timeCutoff };
  }

  // Handle block range filtering
  let blockWhere: any = {};
  let relayDetailWhere: any = {};

  if (blockRange) {
    const latestBlock = await prisma.block.findFirst({
      orderBy: { block_number: 'desc' },
      select: { block_number: true }
    });

    if (latestBlock) {
      const minBlockNumber = Math.max(0, latestBlock.block_number - blockRange);
      blockWhere = {
        block_number: { gte: minBlockNumber }
      };
    }
  }

  // Combine filters for RelayDetail
  relayDetailWhere = { ...whereClause };
  if (blockRange) {
    relayDetailWhere.block = blockWhere;
  }

  const [totalBlocks, totalRelays, avgMetrics] = await Promise.all([
    blockRange ? prisma.block.count({ where: blockWhere }) : prisma.block.count(),
    prisma.relayDetail.findMany({
      where: relayDetailWhere,
      select: { relay_name: true },
      distinct: ['relay_name']
    }),
    (async () => {
      // Build dynamic query for metrics
      let whereConditions = '';
      const params: any[] = [];

      if (timeCutoff) {
        whereConditions = `WHERE rd.created_at >= $1`;
        params.push(timeCutoff);
      }

      if (blockRange) {
        const latestBlock = await prisma.block.findFirst({
          orderBy: { block_number: 'desc' },
          select: { block_number: true }
        });

        if (latestBlock) {
          const minBlockNumber = Math.max(0, latestBlock.block_number - blockRange);
          if (whereConditions) {
            whereConditions += ` AND b.block_number >= $${params.length + 1}`;
          } else {
            whereConditions = `WHERE b.block_number >= $1`;
          }
          params.push(minBlockNumber);
        }
      }

      const query = `
        SELECT
          AVG(rd.latency::numeric) as overall_avg_latency,
          AVG(rd.loss::numeric) as overall_avg_loss,
          MIN(rd.latency::numeric) as best_latency,
          MAX(rd.latency::numeric) as worst_latency,
          MIN(rd.loss::numeric) as best_loss,
          MAX(rd.loss::numeric) as worst_loss
        FROM "RelayDetail" rd
        ${blockRange ? 'JOIN "Block" b ON rd.block_id = b.id' : ''}
        ${whereConditions}
      `;

      const result = await prisma.$queryRawUnsafe(query, ...params) as Array<{
        overall_avg_latency: number | null;
        overall_avg_loss: number | null;
        best_latency: number | null;
        worst_latency: number | null;
        best_loss: number | null;
        worst_loss: number | null;
      }>;

      return result;
    })()
  ]);

  return {
    total_blocks: totalBlocks,
    total_unique_relays: totalRelays.length,
    metrics: avgMetrics[0] || {
      overall_avg_latency: 0,
      overall_avg_loss: 0,
      best_latency: 0,
      worst_latency: 0,
      best_loss: 0,
      worst_loss: 0
    }
  };
}