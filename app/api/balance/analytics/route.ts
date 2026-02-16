import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { decimalToNumber } from '@/lib/utils/format';
import type { ApiResponse } from '@/lib/types/api';

// Maximum number of data points to return (prevents browser overload)
const MAX_CHART_POINTS = 2500;

// Calculate cutoff date based on time range
function getTimeCutoff(timeRange: string, customDays?: number): Date | null {
    const now = new Date();

    if (customDays && customDays > 0) {
        const cutoff = new Date(now);
        cutoff.setDate(cutoff.getDate() - customDays);
        return cutoff;
    }

    switch (timeRange) {
        case '1h':
            return new Date(now.getTime() - 60 * 60 * 1000);
        case '6h':
            return new Date(now.getTime() - 6 * 60 * 60 * 1000);
        case '24h':
            return new Date(now.getTime() - 24 * 60 * 60 * 1000);
        case '7d':
            return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        case '30d':
            return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        case 'all':
        default:
            return null; // No cutoff, fetch all
    }
}

// GET /api/balance/analytics - Get balance tracking data (OPTIMIZED)
export async function GET(request: NextRequest) {
    try {
        const searchParams = request.nextUrl.searchParams;
        const limitParam = searchParams.get('limit');
        const timeRange = searchParams.get('range') || 'all'; // Default to all
        const customDays = searchParams.get('days') ? parseInt(searchParams.get('days')!, 10) : undefined;

        const limit = limitParam === '0' || !limitParam
            ? undefined
            : Math.min(parseInt(limitParam, 10), 1000000);

        // Calculate time cutoff for the selected range
        const timeCutoff = getTimeCutoff(timeRange, customDays);

        // Get count for the time range to determine if downsampling is needed
        const totalCount = timeCutoff
            ? await prisma.balanceSnapshot.count({
                where: { timestamp: { gte: timeCutoff } }
            })
            : await prisma.balanceSnapshot.count();

        // Calculate the sampling interval for server-side downsampling
        const needsDownsampling = !limit && totalCount > MAX_CHART_POINTS;
        const samplingInterval = needsDownsampling
            ? Math.ceil(totalCount / MAX_CHART_POINTS)
            : 1;

        // Run queries in PARALLEL for speed
        const [latestSnapshot, snapshots] = await Promise.all([
            // Get latest snapshot for current balance
            prisma.balanceSnapshot.findFirst({
                orderBy: { timestamp: 'desc' },
                select: {
                    onchain_rlb: true,
                    onchain_usdt: true,
                    onsite_rlb: true,
                    onsite_usd: true,
                    rlb_price_usd: true,
                    timestamp: true
                }
            }),
            // Get snapshots with time filter and optional downsampling
            limit
                ? timeCutoff
                    ? prisma.$queryRaw<any[]>`
                        SELECT timestamp, onsite_usd, onchain_usdt, onsite_rlb, onchain_rlb, rlb_price_usd
                        FROM "BalanceSnapshot"
                        WHERE timestamp >= ${timeCutoff}
                        ORDER BY timestamp ASC
                        LIMIT ${limit}
                    `
                    : prisma.$queryRaw<any[]>`
                        SELECT timestamp, onsite_usd, onchain_usdt, onsite_rlb, onchain_rlb, rlb_price_usd
                        FROM "BalanceSnapshot"
                        ORDER BY timestamp ASC
                        LIMIT ${limit}
                    `
                : needsDownsampling
                    ? timeCutoff
                        ? prisma.$queryRaw<any[]>`
                            SELECT timestamp, onsite_usd, onchain_usdt, onsite_rlb, onchain_rlb, rlb_price_usd
                            FROM (
                                SELECT *, ROW_NUMBER() OVER (ORDER BY timestamp ASC) as rn
                                FROM "BalanceSnapshot"
                                WHERE timestamp >= ${timeCutoff}
                            ) numbered
                            WHERE rn % ${samplingInterval} = 1 OR rn = ${totalCount}
                            ORDER BY timestamp ASC
                        `
                        : prisma.$queryRaw<any[]>`
                            SELECT timestamp, onsite_usd, onchain_usdt, onsite_rlb, onchain_rlb, rlb_price_usd
                            FROM (
                                SELECT *, ROW_NUMBER() OVER (ORDER BY timestamp ASC) as rn
                                FROM "BalanceSnapshot"
                            ) numbered
                            WHERE rn % ${samplingInterval} = 1 OR rn = ${totalCount}
                            ORDER BY timestamp ASC
                        `
                    : timeCutoff
                        ? prisma.$queryRaw<any[]>`
                            SELECT timestamp, onsite_usd, onchain_usdt, onsite_rlb, onchain_rlb, rlb_price_usd
                            FROM "BalanceSnapshot"
                            WHERE timestamp >= ${timeCutoff}
                            ORDER BY timestamp ASC
                        `
                        : prisma.$queryRaw<any[]>`
                            SELECT timestamp, onsite_usd, onchain_usdt, onsite_rlb, onchain_rlb, rlb_price_usd
                            FROM "BalanceSnapshot"
                            ORDER BY timestamp ASC
                        `
        ]);

        if (!latestSnapshot) {
            return NextResponse.json<ApiResponse>({
                success: true,
                data: {
                    currentBalance: {
                        onchain_rlb: 0,
                        onchain_usdt: 0,
                        onsite_rlb: 0,
                        onsite_usd: 0,
                        total_usd: 0,
                        total_usd_usdt: 0,
                        total_rlb: 0
                    },
                    history: []
                }
            });
        }

        // Fetch RLB price - use internal API endpoint (which has caching)
        let rlbPrice = 0;
        let rlbPriceTimestamp = new Date().toISOString();
        try {
            const origin = request.nextUrl.origin || 'http://localhost:3000';
            const priceResponse = await fetch(`${origin}/api/balance/price`, {
                cache: 'no-store'
            });
            if (priceResponse.ok) {
                const priceData = await priceResponse.json();
                rlbPrice = priceData.data?.price_usd || 0;
                rlbPriceTimestamp = priceData.data?.last_updated_at || priceData.data?.timestamp || rlbPriceTimestamp;
            }
        } catch (error) {
            console.error('Error fetching RLB price:', error);
            // Price will default to 0 if fetch fails
        }

        // Calculate current balance in USD
        // Total = onsite_usd + onchain_usdt + (onsite_rlb * price) + (onchain_rlb * price)
        const onsiteRLBValueUSD = decimalToNumber(latestSnapshot.onsite_rlb) * rlbPrice;
        const onchainRLBValueUSD = decimalToNumber(latestSnapshot.onchain_rlb) * rlbPrice;
        const onsiteUSD = decimalToNumber(latestSnapshot.onsite_usd);
        const onchainUSDT = decimalToNumber(latestSnapshot.onchain_usdt);

        const currentBalanceUSD = onsiteUSD + onchainUSDT + onsiteRLBValueUSD + onchainRLBValueUSD;

        // Calculate current balance metrics
        const totalRLB = decimalToNumber(latestSnapshot.onsite_rlb) + decimalToNumber(latestSnapshot.onchain_rlb);
        const totalUSDUSDT = decimalToNumber(latestSnapshot.onsite_usd) + decimalToNumber(latestSnapshot.onchain_usdt);

        // Format history data for chart (handle both Prisma and raw SQL results)
        const history = snapshots.map((snapshot: any) => {
            // Use stored price if available, fallback to current price
            const storedPrice = snapshot.rlb_price_usd;
            const snapshotRLBPrice = storedPrice
                ? (typeof storedPrice === 'object' ? decimalToNumber(storedPrice) : Number(storedPrice))
                : rlbPrice;

            // Handle both Prisma Decimal and raw BigInt/number from SQL
            const toNum = (val: any) => {
                if (val === null || val === undefined) return 0;
                if (typeof val === 'object' && val.toNumber) return val.toNumber(); // Prisma Decimal
                return Number(val);
            };

            const onsiteUsd = toNum(snapshot.onsite_usd);
            const onchainUsdt = toNum(snapshot.onchain_usdt);
            const onsiteRlb = toNum(snapshot.onsite_rlb);
            const onchainRlb = toNum(snapshot.onchain_rlb);

            const snapshotTotalUSD = onsiteUsd + onchainUsdt + (onsiteRlb + onchainRlb) * snapshotRLBPrice;
            const snapshotTotalUSDUSDT = onsiteUsd + onchainUsdt;
            const snapshotTotalRLB = onsiteRlb + onchainRlb;

            // Handle timestamp from both Prisma and raw SQL
            const ts = snapshot.timestamp instanceof Date
                ? snapshot.timestamp.toISOString()
                : new Date(snapshot.timestamp).toISOString();

            return {
                timestamp: ts,
                total_usd: snapshotTotalUSD,
                total_usd_usdt: snapshotTotalUSDUSDT,
                total_rlb: snapshotTotalRLB,
                rlb_price_usd: snapshotRLBPrice
            };
        });

        return NextResponse.json<ApiResponse>({
            success: true,
            data: {
                currentBalance: {
                    onchain_rlb: decimalToNumber(latestSnapshot.onchain_rlb),
                    onchain_usdt: decimalToNumber(latestSnapshot.onchain_usdt),
                    onsite_rlb: decimalToNumber(latestSnapshot.onsite_rlb),
                    onsite_usd: decimalToNumber(latestSnapshot.onsite_usd),
                    total_usd: currentBalanceUSD,
                    onsite_rlb_value_usd: onsiteRLBValueUSD,
                    onchain_rlb_value_usd: onchainRLBValueUSD,
                    onsite_total_usd: onsiteUSD + onsiteRLBValueUSD,
                    onchain_total_usd: onchainUSDT + onchainRLBValueUSD,
                    rlb_price_usd: rlbPrice,
                    rlb_price_last_updated: rlbPriceTimestamp,
                    total_usd_usdt: totalUSDUSDT,
                    total_rlb: totalRLB
                },
                history,
                // Metadata for debugging/display
                meta: {
                    totalSnapshots: totalCount,
                    returnedSnapshots: history.length,
                    downsampled: needsDownsampling,
                    samplingInterval: needsDownsampling ? samplingInterval : 1,
                    timeRange,
                    customDays: customDays || null,
                    timeCutoff: timeCutoff?.toISOString() || null
                }
            }
        });
    } catch (error) {
        console.error('Error fetching balance analytics:', error);
        return NextResponse.json<ApiResponse>({
            success: false,
            error: 'Internal server error'
        }, { status: 500 });
    }
}

