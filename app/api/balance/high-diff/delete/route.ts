import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import type { ApiResponse } from '@/lib/types/api';

/**
 * DELETE /api/balance/high-diff/delete - Permanently delete a specific balance snapshot
 */
export async function DELETE(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const snapshotId = searchParams.get('snapshotId');

    if (!snapshotId) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: 'Snapshot ID is required'
      }, { status: 400 });
    }

    // Find and permanently delete the snapshot from the database
    const snapshot = await prisma.balanceSnapshot.findFirst({
      where: { id: snapshotId }
    });

    if (!snapshot) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: 'Snapshot not found'
      }, { status: 404 });
    }

    // Permanently delete the record from the database
    await prisma.balanceSnapshot.delete({
      where: { id: snapshotId }
    });

    return NextResponse.json<ApiResponse>({
      success: true,
      message: `Permanently deleted balance snapshot ${snapshotId}`,
      data: {
        snapshot_id: snapshotId,
        timestamp: snapshot.timestamp.toISOString()
      }
    });

  } catch (error) {
    console.error('Error removing balance snapshot:', error);
    return NextResponse.json<ApiResponse>({
      success: false,
      error: 'Internal server error'
    }, { status: 500 });
  }
}
