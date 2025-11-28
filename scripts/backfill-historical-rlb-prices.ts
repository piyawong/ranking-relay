/**
 * Backfill Historical RLB Prices
 * Fetches historical price data from CoinGecko and updates snapshots
 * that have stale prices from Nov 26, 2025
 */

import { prisma } from '../lib/db/prisma';

const COINGECKO_API_KEY = 'CG-sK5YVaYp1qWL6ECbMVguVYW1';
const STALE_PRICE = 0.053983;

// Helper to sleep
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Fetch historical price data from CoinGecko
 */
async function fetchHistoricalPrices(fromTimestamp: number, toTimestamp: number) {
    console.log('[Historical Backfill] Fetching historical data from CoinGecko...');

    const response = await fetch(
        `https://api.coingecko.com/api/v3/coins/rollbit-coin/market_chart/range?vs_currency=usd&from=${fromTimestamp}&to=${toTimestamp}`,
        {
            headers: {
                'Accept': 'application/json',
                'x-cg-demo-api-key': COINGECKO_API_KEY,
            }
        }
    );

    if (!response.ok) {
        throw new Error(`CoinGecko API error: ${response.status}`);
    }

    const data = await response.json();

    // data.prices is an array of [timestamp_ms, price] pairs
    return data.prices as [number, number][];
}

/**
 * Interpolate price for a specific timestamp
 */
function interpolatePrice(timestamp: number, historicalData: [number, number][]): number {
    // Find the two closest data points
    let before: [number, number] | null = null;
    let after: [number, number] | null = null;

    for (const point of historicalData) {
        if (point[0] <= timestamp) {
            before = point;
        }
        if (point[0] >= timestamp && !after) {
            after = point;
            break;
        }
    }

    // If exact match, return it
    if (before && before[0] === timestamp) {
        return before[1];
    }
    if (after && after[0] === timestamp) {
        return after[1];
    }

    // Interpolate between before and after
    if (before && after) {
        const timeDiff = after[0] - before[0];
        const priceDiff = after[1] - before[1];
        const timeOffset = timestamp - before[0];
        const interpolated = before[1] + (priceDiff * timeOffset / timeDiff);
        return interpolated;
    }

    // Fallback to closest available
    if (before) return before[1];
    if (after) return after[1];

    throw new Error('No price data available for interpolation');
}

/**
 * Main backfill function
 */
async function backfillHistoricalPrices() {
    console.log('[Historical Backfill] Starting historical price backfill...\n');

    // Define the time range
    const startTime = new Date('2025-11-26T04:00:00Z');
    const endTime = new Date('2025-11-26T23:00:00Z');

    // Find all snapshots with stale prices
    const staleSnapshots = await prisma.balanceSnapshot.findMany({
        where: {
            timestamp: {
                gte: startTime,
                lte: endTime
            },
            rlb_price_usd: STALE_PRICE
        },
        orderBy: { timestamp: 'asc' }
    });

    if (staleSnapshots.length === 0) {
        console.log('[Historical Backfill] No snapshots need backfilling!');
        return;
    }

    console.log(`[Historical Backfill] Found ${staleSnapshots.length} snapshots with stale price $${STALE_PRICE}`);
    console.log(`[Historical Backfill] Time range: ${startTime.toISOString()} to ${endTime.toISOString()}\n`);

    // Fetch historical data from CoinGecko
    const fromTimestamp = Math.floor(startTime.getTime() / 1000);
    const toTimestamp = Math.floor(endTime.getTime() / 1000);

    let historicalData: [number, number][];
    try {
        historicalData = await fetchHistoricalPrices(fromTimestamp, toTimestamp);
        console.log(`[Historical Backfill] Fetched ${historicalData.length} historical price points\n`);
    } catch (error) {
        console.error('[Historical Backfill] Failed to fetch historical data:', error);
        return;
    }

    // Update each snapshot with interpolated historical price
    let updated = 0;
    let failed = 0;

    console.log('[Historical Backfill] Updating snapshots...');

    for (const snapshot of staleSnapshots) {
        try {
            const timestampMs = snapshot.timestamp.getTime();
            const historicalPrice = interpolatePrice(timestampMs, historicalData);

            await prisma.balanceSnapshot.update({
                where: { id: snapshot.id },
                data: { rlb_price_usd: historicalPrice }
            });

            updated++;

            // Log progress every 100 updates
            if (updated % 100 === 0) {
                console.log(`[Historical Backfill] Progress: ${updated}/${staleSnapshots.length} updated`);
            }

            // Small delay to be gentle on the database
            await sleep(10);

        } catch (error) {
            failed++;
            console.error(`[Historical Backfill] Error updating snapshot ${snapshot.id}:`, error);
        }
    }

    console.log(`\n[Historical Backfill] ✅ Completed!`);
    console.log(`[Historical Backfill] Updated: ${updated}`);
    console.log(`[Historical Backfill] Failed: ${failed}`);

    // Show sample of updated prices
    console.log('\n[Historical Backfill] Sample of updated prices:');
    const sampleSnapshots = await prisma.balanceSnapshot.findMany({
        where: {
            timestamp: {
                gte: startTime,
                lte: endTime
            }
        },
        orderBy: { timestamp: 'asc' },
        take: 10,
        select: {
            timestamp: true,
            rlb_price_usd: true
        }
    });

    sampleSnapshots.forEach(s => {
        console.log(`  ${s.timestamp.toISOString()} - $${s.rlb_price_usd?.toFixed(6)}`);
    });
}

// Run the backfill
backfillHistoricalPrices()
    .then(() => {
        console.log('\n[Historical Backfill] Process completed');
        process.exit(0);
    })
    .catch((error) => {
        console.error('[Historical Backfill] Fatal error:', error);
        process.exit(1);
    });
