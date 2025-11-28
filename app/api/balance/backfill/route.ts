import { NextRequest, NextResponse } from 'next/server';
import { runBackfillOnce } from '@/lib/services/price-backfill-service';
// Use .js version to share cache with server.js price-refresh-service
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { getRateLimitStatus } = require('@/lib/utils/rlb-price-service.js');
import { prisma } from '@/lib/db/prisma';
import type { ApiResponse } from '@/lib/types/api';

// GET /api/balance/backfill - Get backfill status
export async function GET() {
    try {
        // Get count of snapshots without prices
        const [totalSnapshots, snapshotsWithoutPrice, recentWithoutPrice] = await Promise.all([
            prisma.balanceSnapshot.count(),
            prisma.balanceSnapshot.count({
                where: { rlb_price_usd: null }
            }),
            prisma.balanceSnapshot.count({
                where: {
                    rlb_price_usd: null,
                    timestamp: {
                        gte: new Date(Date.now() - 24 * 60 * 60 * 1000) // Last 24 hours
                    }
                }
            })
        ]);

        const rateLimitStatus = getRateLimitStatus();

        return NextResponse.json<ApiResponse>({
            success: true,
            data: {
                snapshots: {
                    total: totalSnapshots,
                    withoutPrice: snapshotsWithoutPrice,
                    withoutPricePercent: totalSnapshots > 0
                        ? ((snapshotsWithoutPrice / totalSnapshots) * 100).toFixed(2) + '%'
                        : '0%',
                    recentWithoutPrice: recentWithoutPrice
                },
                rateLimit: rateLimitStatus,
                message: snapshotsWithoutPrice === 0
                    ? 'All snapshots have RLB prices!'
                    : `${snapshotsWithoutPrice} snapshots need price backfilling`
            }
        });
    } catch (error) {
        console.error('Error getting backfill status:', error);
        return NextResponse.json<ApiResponse>({
            success: false,
            error: 'Failed to get backfill status'
        }, { status: 500 });
    }
}

// POST /api/balance/backfill - Trigger manual backfill
export async function POST(request: NextRequest) {
    try {
        const searchParams = request.nextUrl.searchParams;
        const limit = parseInt(searchParams.get('limit') || '10', 10);

        console.log('[Backfill API] Starting manual backfill...');

        // Get snapshots without prices
        const snapshotsWithoutPrice = await prisma.balanceSnapshot.findMany({
            where: { rlb_price_usd: null },
            take: Math.min(limit, 50), // Max 50 at once
            orderBy: { timestamp: 'desc' }
        });

        if (snapshotsWithoutPrice.length === 0) {
            return NextResponse.json<ApiResponse>({
                success: true,
                message: 'No snapshots need backfilling',
                data: {
                    processed: 0,
                    updated: 0,
                    failed: 0
                }
            });
        }

        // Run backfill
        await runBackfillOnce();

        // Get updated counts
        const updatedCount = await prisma.balanceSnapshot.count({
            where: {
                id: {
                    in: snapshotsWithoutPrice.map(s => s.id)
                },
                rlb_price_usd: { not: null }
            }
        });

        return NextResponse.json<ApiResponse>({
            success: true,
            message: `Backfill completed: ${updatedCount} snapshots updated`,
            data: {
                processed: snapshotsWithoutPrice.length,
                updated: updatedCount,
                failed: snapshotsWithoutPrice.length - updatedCount
            }
        });
    } catch (error) {
        console.error('Error running manual backfill:', error);
        return NextResponse.json<ApiResponse>({
            success: false,
            error: 'Failed to run backfill'
        }, { status: 500 });
    }
}