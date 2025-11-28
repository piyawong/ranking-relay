import { NextResponse } from 'next/server';
import type { ApiResponse } from '@/lib/types/api';

const COINGECKO_API_KEY = 'CG-sK5YVaYp1qWL6ECbMVguVYW1';
const CACHE_DURATION = 60; // Cache for 60 seconds to respect rate limits (30 req/min)

// In-memory cache to avoid hitting rate limits
let priceCache: {
    price: number;
    timestamp: string;
    lastUpdated: number;
} | null = null;

// GET /api/balance/price - Get RLB price from CoinGecko
export async function GET() {
    try {
        const now = Date.now();

        // Return cached price if still valid (within cache duration)
        if (priceCache && (now - priceCache.lastUpdated) < CACHE_DURATION * 1000) {
            return NextResponse.json<ApiResponse>({
                success: true,
                data: {
                    symbol: 'RLB',
                    price_usd: priceCache.price,
                    source: 'coingecko',
                    timestamp: priceCache.timestamp,
                    last_updated_at: priceCache.timestamp,
                    cached: true
                }
            });
        }

        // Fetch from CoinGecko Simple Price API (with API key for better rate limits)
        const response = await fetch(
            'https://api.coingecko.com/api/v3/simple/price?ids=rollbit-coin&vs_currencies=usd&include_last_updated_at=true',
            {
                headers: {
                    'Accept': 'application/json',
                    'x-cg-demo-api-key': COINGECKO_API_KEY,
                },
                next: { revalidate: CACHE_DURATION } // Next.js cache
            }
        );

        if (!response.ok) {
            const errorText = await response.text();
            console.error(`[Price API] CoinGecko API error: ${response.status} - ${errorText}`);
            // If rate limited, return cached value if available
            if (response.status === 429 && priceCache) {
                return NextResponse.json<ApiResponse>({
                    success: true,
                    data: {
                        symbol: 'RLB',
                        price_usd: priceCache.price,
                        source: 'coingecko',
                        timestamp: priceCache.timestamp,
                        last_updated_at: priceCache.timestamp,
                        cached: true,
                        rate_limited: true
                    }
                });
            }
            throw new Error(`Failed to fetch price from CoinGecko: ${response.status} - ${errorText}`);
        }

        const data = await response.json();
        console.log('[Price API] CoinGecko response:', JSON.stringify(data));
        const price = data['rollbit-coin']?.usd || 0;

        if (price === 0) {
            console.warn('[Price API] Price is 0, response was:', JSON.stringify(data));
            console.warn('[Price API] Available keys:', Object.keys(data));
        }

        const lastUpdatedTimestamp = data['rollbit-coin']?.last_updated_at
            ? new Date(data['rollbit-coin'].last_updated_at * 1000).toISOString()
            : new Date().toISOString();
        const currentTimestamp = new Date().toISOString();

        // Update cache
        priceCache = {
            price,
            timestamp: currentTimestamp,
            lastUpdated: now
        };

        return NextResponse.json<ApiResponse>({
            success: true,
            data: {
                symbol: 'RLB',
                price_usd: price,
                source: 'coingecko',
                timestamp: currentTimestamp,
                last_updated_at: lastUpdatedTimestamp,
                cached: false
            }
        });
    } catch (error) {
        console.error('Error fetching RLB price:', error);

        // Return cached value if available, even if expired
        if (priceCache) {
            return NextResponse.json<ApiResponse>({
                success: true,
                data: {
                    symbol: 'RLB',
                    price_usd: priceCache.price,
                    source: 'coingecko',
                    timestamp: priceCache.timestamp,
                    last_updated_at: priceCache.timestamp,
                    cached: true,
                    error: error instanceof Error ? error.message : 'Unknown error'
                }
            });
        }

        // Fallback: return error
        return NextResponse.json<ApiResponse>({
            success: false,
            error: 'Failed to fetch RLB price',
            data: {
                symbol: 'RLB',
                price_usd: 0,
                source: 'error',
                timestamp: new Date().toISOString(),
                last_updated_at: new Date().toISOString()
            }
        }, { status: 500 });
    }
}
