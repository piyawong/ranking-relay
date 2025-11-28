/**
 * Price Backfill Service (JavaScript version)
 * Automatically backfills missing RLB prices for snapshots
 */

const { prisma } = require('../db/prisma.js');
const { fetchRLBPrice, getRateLimitStatus } = require('../utils/rlb-price-service.js');

const BACKFILL_INTERVAL = 5 * 60 * 1000; // Run every 5 minutes (safety net)
const BATCH_SIZE = 10; // Process 10 snapshots at a time to respect rate limits
let isRunning = false;
let intervalId = null;

/**
 * Backfill missing prices for recent snapshots
 */
async function backfillMissingPrices() {
    if (isRunning) {
        console.log('[Price Backfill] Already running, skipping...');
        return;
    }

    isRunning = true;

    try {
        // Get rate limit status
        const rateLimitStatus = getRateLimitStatus();
        console.log('[Price Backfill] Starting backfill process...');
        console.log('[Price Backfill] Rate limit status:', {
            remainingCalls: rateLimitStatus.remainingCalls,
            resetInSeconds: rateLimitStatus.resetInSeconds
        });

        // Find snapshots without prices from the last 24 hours
        const oneDayAgo = new Date();
        oneDayAgo.setDate(oneDayAgo.getDate() - 1);

        const snapshotsWithoutPrice = await prisma.balanceSnapshot.findMany({
            where: {
                rlb_price_usd: null,
                timestamp: {
                    gte: oneDayAgo
                }
            },
            take: BATCH_SIZE,
            orderBy: {
                timestamp: 'desc'
            }
        });

        if (snapshotsWithoutPrice.length === 0) {
            console.log('[Price Backfill] No snapshots need price backfilling');
            return;
        }

        console.log(`[Price Backfill] Found ${snapshotsWithoutPrice.length} snapshots without prices`);

        let updated = 0;
        let failed = 0;

        // Fetch fresh price ONCE per backfill cycle (force refresh to avoid stale cache)
        const currentPrice = await fetchRLBPrice(true);

        if (!currentPrice) {
            console.error('[Price Backfill] Failed to fetch current RLB price, aborting batch');
            return;
        }

        console.log(`[Price Backfill] Using fresh price $${currentPrice.toFixed(6)} for all snapshots in this batch`);

        for (const snapshot of snapshotsWithoutPrice) {
            try {
                // Use the same fresh price for all snapshots in this batch
                await prisma.balanceSnapshot.update({
                    where: { id: snapshot.id },
                    data: { rlb_price_usd: currentPrice }
                });
                updated++;
                console.log(`[Price Backfill] Updated snapshot ${snapshot.id} (${snapshot.timestamp.toISOString()}) with price $${currentPrice.toFixed(6)}`);

                // Small delay between updates
                await new Promise(resolve => setTimeout(resolve, 100));

            } catch (error) {
                failed++;
                console.error(`[Price Backfill] Error updating snapshot ${snapshot.id}:`, error);
            }
        }

        console.log(`[Price Backfill] Completed: ${updated} updated, ${failed} failed`);

    } catch (error) {
        console.error('[Price Backfill] Error during backfill process:', error);
    } finally {
        isRunning = false;
    }
}

/**
 * Start the background price backfill service
 */
function startPriceBackfillService() {
    if (intervalId) {
        console.log('[Price Backfill] Service already running');
        return;
    }

    console.log('[Price Backfill] Starting background service...');
    console.log(`[Price Backfill] Will run every ${BACKFILL_INTERVAL / 1000 / 60} minutes`);

    // Run immediately on start
    backfillMissingPrices();

    // Then run periodically
    intervalId = setInterval(backfillMissingPrices, BACKFILL_INTERVAL);
}

/**
 * Stop the background price backfill service
 */
function stopPriceBackfillService() {
    if (intervalId) {
        clearInterval(intervalId);
        intervalId = null;
        console.log('[Price Backfill] Service stopped');
    }
}

/**
 * Run backfill once (for manual triggering)
 */
async function runBackfillOnce() {
    await backfillMissingPrices();
}

module.exports = {
    startPriceBackfillService,
    stopPriceBackfillService,
    runBackfillOnce,
    backfillMissingPrices
};
