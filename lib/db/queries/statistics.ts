import { prisma } from '../prisma';
import type { RelayStatistics } from '@prisma/client';
import { decimalToNumber } from '@/lib/utils/format';

/**
 * Get all relay statistics
 */
export async function getAllStatistics(): Promise<RelayStatistics[]> {
  return prisma.relayStatistics.findMany({
    orderBy: { avg_latency: 'asc' }
  });
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
export async function getPerformanceSummary() {
  const [totalBlocks, totalRelays, avgMetrics] = await Promise.all([
    prisma.block.count(),
    prisma.relayDetail.findMany({
      select: { relay_name: true },
      distinct: ['relay_name']
    }),
    prisma.$queryRaw`
      SELECT
        AVG(latency::numeric) as overall_avg_latency,
        AVG(loss::numeric) as overall_avg_loss,
        MIN(latency::numeric) as best_latency,
        MAX(latency::numeric) as worst_latency,
        MIN(loss::numeric) as best_loss,
        MAX(loss::numeric) as worst_loss
      FROM "RelayDetail"
    ` as Promise<Array<{
      overall_avg_latency: number | null;
      overall_avg_loss: number | null;
      best_latency: number | null;
      worst_latency: number | null;
      best_loss: number | null;
      worst_loss: number | null;
    }>>
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