import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { decimalToNumber } from '@/lib/utils/format';
import type { ApiResponse } from '@/lib/types/api';

// GET /api/balance/analytics - Get balance tracking data
export async function GET(request: NextRequest) {
    try {
        const searchParams = request.nextUrl.searchParams;
        const limitParam = searchParams.get('limit');
        // If limit is 0 or not provided, fetch all data. Otherwise, cap at 1 million records
        const limit = limitParam === '0' || !limitParam
            ? undefined
            : Math.min(parseInt(limitParam, 10), 1000000);

        // Get latest snapshot for current balance
        const latestSnapshot = await prisma.balanceSnapshot.findFirst({
            orderBy: { timestamp: 'desc' }
        });

        // Get snapshots for chart
        const snapshots = await prisma.balanceSnapshot.findMany({
            ...(limit ? { take: limit } : {}),
            orderBy: { timestamp: 'asc' }
        });

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

        // Format history data for chart
        const history = snapshots.map((snapshot) => {
            // Use stored price if available, fallback to current price
            const snapshotRLBPrice = snapshot.rlb_price_usd
                ? decimalToNumber(snapshot.rlb_price_usd)
                : rlbPrice;

            const snapshotTotalUSD =
                decimalToNumber(snapshot.onsite_usd) +
                decimalToNumber(snapshot.onchain_usdt) +
                decimalToNumber(snapshot.onsite_rlb) * snapshotRLBPrice +
                decimalToNumber(snapshot.onchain_rlb) * snapshotRLBPrice;
            const snapshotTotalUSDUSDT =
                decimalToNumber(snapshot.onsite_usd) +
                decimalToNumber(snapshot.onchain_usdt);
            const snapshotTotalRLB =
                decimalToNumber(snapshot.onsite_rlb) +
                decimalToNumber(snapshot.onchain_rlb);

            return {
                timestamp: snapshot.timestamp.toISOString(),
                total_usd: snapshotTotalUSD,
                total_usd_usdt: snapshotTotalUSDUSDT,
                total_rlb: snapshotTotalRLB,
                rlb_price_usd: snapshotRLBPrice // Include price for reference
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
                history
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

