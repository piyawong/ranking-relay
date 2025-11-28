import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import type { ApiResponse } from '@/lib/types/api';

/**
 * DELETE /api/balance/high-diff/delete - Permanently delete balance snapshot(s)
 * Supports both single deletion (?snapshotId=xxx) and batch deletion (POST with body)
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

/**
 * POST /api/balance/high-diff/delete - Batch delete multiple snapshots
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const snapshotIds = body.snapshotIds as string[];

    if (!Array.isArray(snapshotIds) || snapshotIds.length === 0) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: 'snapshotIds array is required'
      }, { status: 400 });
    }

    // Batch delete all snapshots at once
    const result = await prisma.balanceSnapshot.deleteMany({
      where: {
        id: {
          in: snapshotIds
        }
      }
    });

    return NextResponse.json<ApiResponse>({
      success: true,
      message: `Batch deleted ${result.count} snapshots`,
      data: {
        deletedCount: result.count,
        requestedCount: snapshotIds.length
      }
    });

  } catch (error) {
    console.error('Error batch deleting snapshots:', error);
    return NextResponse.json<ApiResponse>({
      success: false,
      error: 'Internal server error'
    }, { status: 500 });
  }
}
