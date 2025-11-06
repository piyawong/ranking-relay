import { NextRequest, NextResponse } from 'next/server';
import {
  getAllStatistics,
  getRelayStatistics,
  getPerformanceSummary
} from '@/lib/db/queries/statistics';
import { StatsQuerySchema } from '@/lib/utils/validation';
import { decimalToNumber } from '@/lib/utils/format';
import type { ApiResponse, RelayStatisticsData } from '@/lib/types/api';

// GET /api/statistics - Get relay statistics
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const params = Object.fromEntries(searchParams.entries());

    const query = StatsQuerySchema.parse(params);

    // If specific relay requested
    if (query.relayName) {
      const stats = await getRelayStatistics(query.relayName);

      if (!stats) {
        return NextResponse.json<ApiResponse>({
          success: false,
          error: 'Relay not found'
        }, { status: 404 });
      }

      const transformedStats: RelayStatisticsData = {
        id: stats.id,
        relay_name: stats.relay_name,
        total_blocks: stats.total_blocks,
        avg_latency: decimalToNumber(stats.avg_latency),
        avg_loss: decimalToNumber(stats.avg_loss),
        first_arrival_count: stats.first_arrival_count,
        last_updated: stats.last_updated.toISOString()
      };

      return NextResponse.json<ApiResponse<RelayStatisticsData>>({
        success: true,
        data: transformedStats
      });
    }

    // Get all statistics
    const [allStats, summary] = await Promise.all([
      getAllStatistics(),
      getPerformanceSummary()
    ]);

    // Transform statistics
    const transformedStats = allStats.slice(0, query.limit).map(stat => ({
      id: stat.id,
      relay_name: stat.relay_name,
      total_blocks: stat.total_blocks,
      avg_latency: decimalToNumber(stat.avg_latency),
      avg_loss: decimalToNumber(stat.avg_loss),
      first_arrival_count: stat.first_arrival_count,
      last_updated: stat.last_updated.toISOString()
    }));

    // Transform summary metrics
    const transformedSummary = {
      ...summary,
      metrics: {
        overall_avg_latency: Number(summary.metrics.overall_avg_latency || 0),
        overall_avg_loss: Number(summary.metrics.overall_avg_loss || 0),
        best_latency: Number(summary.metrics.best_latency || 0),
        worst_latency: Number(summary.metrics.worst_latency || 0),
        best_loss: Number(summary.metrics.best_loss || 0),
        worst_loss: Number(summary.metrics.worst_loss || 0)
      }
    };

    return NextResponse.json<ApiResponse>({
      success: true,
      data: {
        statistics: transformedStats,
        summary: transformedSummary
      }
    });
  } catch (error) {
    console.error('Error fetching statistics:', error);
    return NextResponse.json<ApiResponse>({
      success: false,
      error: 'Internal server error'
    }, { status: 500 });
  }
}