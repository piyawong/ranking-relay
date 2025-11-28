import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { BalanceSnapshotSchema } from '@/lib/utils/balance-validation';
import { prisma } from '@/lib/db/prisma';
import { decimalToNumber } from '@/lib/utils/format';
import type { ApiResponse } from '@/lib/types/api';

// POST /api/balance/snapshot - Save a balance snapshot
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const validated = BalanceSnapshotSchema.parse(body);

        // Parse timestamp or use current time
        const timestamp = validated.ts ? new Date(validated.ts) : new Date();

        // Fetch current RLB price
        let rlbPrice: number | null = null;
        try {
            const origin = request.nextUrl.origin || 'http://localhost:3000';
            const priceResponse = await fetch(`${origin}/api/balance/price`, {
                cache: 'no-store'
            });
            if (priceResponse.ok) {
                const priceData = await priceResponse.json();
                rlbPrice = priceData.data?.price_usd || null;
            }
        } catch (error) {
            console.error('Failed to fetch RLB price for snapshot:', error);
            // Continue without price - field is optional
        }

        // Create balance snapshot
        const snapshot = await prisma.balanceSnapshot.create({
            data: {
                timestamp,
                pid: validated.pid || null,
                onchain_rlb: validated.onchain.rlb,
                onchain_usdt: validated.onchain.usdt,
                onsite_rlb: validated.onsite.rlb,
                onsite_usd: validated.onsite.usd,
                rlb_price_usd: rlbPrice,
            }
        });

        return NextResponse.json<ApiResponse>({
            success: true,
            message: 'Balance snapshot saved successfully',
            data: {
                id: snapshot.id,
                timestamp: snapshot.timestamp.toISOString(),
                onchain: {
                    rlb: decimalToNumber(snapshot.onchain_rlb),
                    usdt: decimalToNumber(snapshot.onchain_usdt)
                },
                onsite: {
                    rlb: decimalToNumber(snapshot.onsite_rlb),
                    usd: decimalToNumber(snapshot.onsite_usd)
                }
            }
        });
    } catch (error) {
        if (error instanceof z.ZodError) {
            return NextResponse.json<ApiResponse>({
                success: false,
                error: 'Validation error',
                details: error.errors
            }, { status: 400 });
        }

        console.error('Error saving balance snapshot:', error);
        return NextResponse.json<ApiResponse>({
            success: false,
            error: 'Internal server error'
        }, { status: 500 });
    }
}

// GET /api/balance/snapshot - Get latest balance snapshots
export async function GET(request: NextRequest) {
    try {
        const searchParams = request.nextUrl.searchParams;
        const limit = parseInt(searchParams.get('limit') || '100', 10);
        const offset = parseInt(searchParams.get('offset') || '0', 10);

        const [snapshots, total] = await Promise.all([
            prisma.balanceSnapshot.findMany({
                skip: offset,
                take: limit,
                orderBy: { timestamp: 'desc' },
                select: {
                    id: true,
                    timestamp: true,
                    pid: true,
                    onchain_rlb: true,
                    onchain_usdt: true,
                    onsite_rlb: true,
                    onsite_usd: true,
                    rlb_price_usd: true,
                    created_at: true
                }
            }),
            prisma.balanceSnapshot.count()
        ]);

        const transformedSnapshots = snapshots.map(snapshot => ({
            id: snapshot.id,
            ts: snapshot.timestamp.toISOString(),
            pid: snapshot.pid,
            onchain: {
                rlb: decimalToNumber(snapshot.onchain_rlb),
                usdt: decimalToNumber(snapshot.onchain_usdt)
            },
            onsite: {
                rlb: decimalToNumber(snapshot.onsite_rlb),
                usd: decimalToNumber(snapshot.onsite_usd)
            },
            rlb_price_usd: snapshot.rlb_price_usd ? decimalToNumber(snapshot.rlb_price_usd) : null,
            created_at: snapshot.created_at.toISOString()
        }));

        return NextResponse.json<ApiResponse>({
            success: true,
            data: {
                snapshots: transformedSnapshots,
                pagination: {
                    total,
                    limit,
                    offset,
                    hasMore: offset + limit < total
                }
            }
        });
    } catch (error) {
        console.error('Error fetching balance snapshots:', error);
        return NextResponse.json<ApiResponse>({
            success: false,
            error: 'Internal server error'
        }, { status: 500 });
    }
}

// DELETE /api/balance/snapshot - Delete all balance snapshots
export async function DELETE(request: NextRequest) {
    try {
        const searchParams = request.nextUrl.searchParams;
        const confirm = searchParams.get('confirm');

        // Require explicit confirmation
        if (confirm !== 'true') {
            return NextResponse.json<ApiResponse>({
                success: false,
                error: 'Confirmation required. Add ?confirm=true to the URL'
            }, { status: 400 });
        }

        // Get count before deletion
        const count = await prisma.balanceSnapshot.count();

        // Delete all balance snapshots
        const result = await prisma.balanceSnapshot.deleteMany({});

        return NextResponse.json<ApiResponse>({
            success: true,
            message: `Successfully deleted ${result.count} balance snapshot(s)`,
            data: {
                deletedCount: result.count,
                previousCount: count
            }
        });
    } catch (error) {
        console.error('Error deleting balance snapshots:', error);
        return NextResponse.json<ApiResponse>({
            success: false,
            error: 'Internal server error'
        }, { status: 500 });
    }
}
