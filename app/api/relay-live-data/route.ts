import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';

/**
 * GET /api/relay-live-data
 *
 * Fetches live data for all relay nodes from the database.
 * This data is populated by the relay-collector service.
 *
 * Query params:
 * - nodeId: Filter by specific node ID (optional)
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const nodeId = searchParams.get('nodeId');

    const where = nodeId ? { node_id: nodeId } : {};

    const liveData = await prisma.relayLiveData.findMany({
      where,
      orderBy: { updated_at: 'desc' },
    });

    // Transform to frontend format
    const transformedData = liveData.map((item) => ({
      nodeId: item.node_id,
      meshPeerCount: item.mesh_peer_count,
      meshPeers: item.mesh_peers,
      peerCount: item.peer_count,
      peers: item.peers,
      trustedPeers: item.trusted_peers,
      config: item.config,
      healthStatus: item.health_status,
      discoveryStats: item.discovery_stats,
      lastError: item.last_error,
      isOnline: item.is_online,
      updatedAt: item.updated_at.toISOString(),
    }));

    return NextResponse.json({
      success: true,
      data: transformedData,
      count: transformedData.length,
    });
  } catch (error) {
    console.error('[API] Error fetching relay live data:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch relay live data' },
      { status: 500 }
    );
  }
}
