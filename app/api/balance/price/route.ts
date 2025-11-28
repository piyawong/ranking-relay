import { NextResponse } from 'next/server';
// Use .js version to share cache with server.js price-refresh-service
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { fetchRLBPrice, getRateLimitStatus } = require('@/lib/utils/rlb-price-service.js');
import type { ApiResponse } from '@/lib/types/api';

// Disable Next.js caching for this route
export const dynamic = 'force-dynamic';
export const revalidate = 0;

// GET /api/balance/price - Get RLB price using centralized service
export async function GET() {
    try {
        // Fetch price using centralized service
        const price = await fetchRLBPrice();
        const rateLimitStatus = getRateLimitStatus();

        if (price) {
            const response = NextResponse.json<ApiResponse>({
                success: true,
                data: {
                    symbol: 'RLB',
                    price_usd: price,
                    source: 'coingecko',
                    timestamp: new Date().toISOString(),
                    cached: rateLimitStatus.cacheStatus !== null,
                    cacheAge: rateLimitStatus.cacheStatus?.ageSeconds || 0,
                    rateLimit: {
                        remainingCalls: rateLimitStatus.remainingCalls,
                        resetInSeconds: rateLimitStatus.resetInSeconds
                    }
                }
            });
            response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate');
            return response;
        }

        // No price available
        return NextResponse.json<ApiResponse>({
            success: false,
            error: 'Unable to fetch RLB price',
            data: {
                symbol: 'RLB',
                price_usd: 0,
                source: 'error',
                timestamp: new Date().toISOString(),
                rateLimit: {
                    remainingCalls: rateLimitStatus.remainingCalls,
                    resetInSeconds: rateLimitStatus.resetInSeconds
                }
            }
        }, { status: 503 });

    } catch (error) {
        console.error('Error in price API:', error);
        return NextResponse.json<ApiResponse>({
            success: false,
            error: error instanceof Error ? error.message : 'Failed to fetch RLB price'
        }, { status: 500 });
    }
}
