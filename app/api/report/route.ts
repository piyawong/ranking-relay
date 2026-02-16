import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import type { ApiResponse } from '@/lib/types/api';

/**
 * GET /api/report
 *
 * Generates a report of block history with relay details mapped to relay nodes.
 *
 * Query params:
 * - startDate: Start date filter (ISO format)
 * - endDate: End date filter (ISO format)
 * - startBlock: Start block number filter
 * - endBlock: End block number filter
 * - relayNames: Comma-separated list of relay names to include
 * - limit: Maximum number of blocks to return (default: 1000)
 * - format: 'json' or 'csv' (default: 'json')
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;

    // Parse filters
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const startBlock = searchParams.get('startBlock');
    const endBlock = searchParams.get('endBlock');
    const relayNamesParam = searchParams.get('relayNames');
    const limit = Math.min(parseInt(searchParams.get('limit') || '1000', 10), 10000);
    const format = searchParams.get('format') || 'json';

    const relayNames = relayNamesParam ? relayNamesParam.split(',').filter(Boolean) : [];

    // Build where clause for blocks
    const blockWhere: {
      created_at?: { gte?: Date; lte?: Date };
      block_number?: { gte?: number; lte?: number };
    } = {};

    if (startDate) {
      blockWhere.created_at = { ...blockWhere.created_at, gte: new Date(startDate) };
    }
    if (endDate) {
      // Add 1 day to include the end date fully
      const endDateTime = new Date(endDate);
      endDateTime.setDate(endDateTime.getDate() + 1);
      blockWhere.created_at = { ...blockWhere.created_at, lte: endDateTime };
    }
    if (startBlock) {
      blockWhere.block_number = { ...blockWhere.block_number, gte: parseInt(startBlock, 10) };
    }
    if (endBlock) {
      blockWhere.block_number = { ...blockWhere.block_number, lte: parseInt(endBlock, 10) };
    }

    // Fetch relay nodes for mapping
    const relayNodes = await prisma.relayNode.findMany({
      select: {
        id: true,
        name: true,
        tag: true,
        latitude: true,
        longitude: true,
        location: true,
        country: true,
        status: true,
        endpoint: true,
      },
    });

    // Create relay name -> node map
    const relayNodeMap = new Map(relayNodes.map(node => [node.name, node]));

    // Fetch blocks with relay details
    const blocks = await prisma.block.findMany({
      where: blockWhere,
      orderBy: { block_number: 'desc' },
      take: limit,
      include: {
        RelayDetail: {
          orderBy: { arrival_order: 'asc' },
          where: relayNames.length > 0 ? {
            relay_name: { in: relayNames }
          } : undefined,
        },
      },
    });

    // Transform data to flat format with node info
    const reportData: Array<{
      block_number: number;
      block_hash: string | null;
      block_created_at: string;
      bloxroute_timestamp: string | null;
      bloxroute_origin: string | null;
      relay_name: string;
      arrival_order: number;
      latency: number;
      loss: number;
      arrival_timestamp: string | null;
      ranking_score: number;
      // Relay node fields
      node_id: string | null;
      node_tag: string | null;
      node_latitude: number | null;
      node_longitude: number | null;
      node_location: string | null;
      node_country: string | null;
      node_status: string | null;
      node_endpoint: string | null;
      is_mapped: boolean;
    }> = [];

    for (const block of blocks) {
      for (const detail of block.RelayDetail) {
        const node = relayNodeMap.get(detail.relay_name);

        reportData.push({
          block_number: block.block_number,
          block_hash: block.block_hash,
          block_created_at: block.created_at.toISOString(),
          bloxroute_timestamp: block.bloxroute_timestamp?.toISOString() || null,
          bloxroute_origin: block.origin,
          relay_name: detail.relay_name,
          arrival_order: detail.arrival_order,
          latency: parseFloat(detail.latency.toString()),
          loss: parseFloat(detail.loss.toString()),
          arrival_timestamp: detail.arrival_timestamp?.toISOString() || null,
          ranking_score: parseFloat(detail.ranking_score.toString()),
          // Relay node fields
          node_id: node?.id || null,
          node_tag: node?.tag || null,
          node_latitude: node ? parseFloat(node.latitude.toString()) : null,
          node_longitude: node ? parseFloat(node.longitude.toString()) : null,
          node_location: node?.location || null,
          node_country: node?.country || null,
          node_status: node?.status || null,
          node_endpoint: node?.endpoint || null,
          is_mapped: !!node,
        });
      }
    }

    // Return CSV format
    if (format === 'csv') {
      const headers = [
        'block_number',
        'block_hash',
        'block_created_at',
        'bloxroute_timestamp',
        'bloxroute_origin',
        'relay_name',
        'arrival_order',
        'latency',
        'loss',
        'arrival_timestamp',
        'ranking_score',
        'node_id',
        'node_tag',
        'node_latitude',
        'node_longitude',
        'node_location',
        'node_country',
        'node_status',
        'node_endpoint',
        'is_mapped',
      ];

      const csvRows = [headers.join(',')];

      for (const row of reportData) {
        const values = headers.map(header => {
          const value = row[header as keyof typeof row];
          if (value === null || value === undefined) return '';
          if (typeof value === 'string') {
            // Escape quotes and wrap in quotes if contains comma
            const escaped = value.replace(/"/g, '""');
            return escaped.includes(',') || escaped.includes('"') || escaped.includes('\n')
              ? `"${escaped}"`
              : escaped;
          }
          return String(value);
        });
        csvRows.push(values.join(','));
      }

      const csv = csvRows.join('\n');

      return new NextResponse(csv, {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="relay-report-${new Date().toISOString().split('T')[0]}.csv"`,
        },
      });
    }

    // Return JSON format
    return NextResponse.json<ApiResponse>({
      success: true,
      data: {
        report: reportData,
        summary: {
          totalBlocks: blocks.length,
          totalRecords: reportData.length,
          mappedRecords: reportData.filter(r => r.is_mapped).length,
          unmappedRecords: reportData.filter(r => !r.is_mapped).length,
          uniqueRelays: new Set(reportData.map(r => r.relay_name)).size,
          filters: {
            startDate: startDate || null,
            endDate: endDate || null,
            startBlock: startBlock ? parseInt(startBlock, 10) : null,
            endBlock: endBlock ? parseInt(endBlock, 10) : null,
            relayNames: relayNames.length > 0 ? relayNames : null,
          },
        },
      },
    });
  } catch (error) {
    console.error('[Report API] Error generating report:', error);
    return NextResponse.json<ApiResponse>({
      success: false,
      error: 'Failed to generate report',
    }, { status: 500 });
  }
}
