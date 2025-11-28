import { NextRequest, NextResponse } from 'next/server';
import {
  getAllStatistics,
  getRelayStatistics,
  getPerformanceSummary,
  updateAllStatistics
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

    // Get all statistics with filters
    const filters = {
      timeRange: query.timeRange,
      blockRange: query.blockRange
    };

    const [allStats, summary] = await Promise.all([
      getAllStatistics(filters),
      getPerformanceSummary(filters)
    ]);

    // Transform statistics - return all relays (no limit applied, or use provided limit)
    const transformedStats = allStats.map(stat => ({
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

// POST /api/statistics - Refresh cached statistics table
// Note: Statistics are now computed directly from RelayDetail, 
// but this endpoint can be used to refresh the cache table for consistency
export async function POST(_request: NextRequest) {
  try {
    await updateAllStatistics();

    return NextResponse.json<ApiResponse>({
      success: true,
      message: 'Statistics refreshed successfully'
    });
  } catch (error) {
    console.error('Error refreshing statistics:', error);
    return NextResponse.json<ApiResponse>({
      success: false,
      error: 'Internal server error'
    }, { status: 500 });
  }
}