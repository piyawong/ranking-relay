/**
 * Price Refresh Service (JavaScript version)
 * Actively refreshes RLB price cache every minute to ensure data is always fresh
 */

const { fetchRLBPrice, getRateLimitStatus } = require('../utils/rlb-price-service.js');

const REFRESH_INTERVAL = 60 * 1000; // Refresh every 60 seconds
let intervalId = null;
let isRunning = false;
let lastSuccessfulFetch = null;
let consecutiveFailures = 0;
const MAX_FAILURES_BEFORE_ALERT = 5;

/**
 * Refresh the price cache
 */
async function refreshPrice() {
    if (isRunning) {
        console.log('[Price Refresh] Already running, skipping...');
        return;
    }

    isRunning = true;

    try {
        const rateLimitStatus = getRateLimitStatus();
        console.log('[Price Refresh] Fetching fresh RLB price...');
        console.log('[Price Refresh] Rate limit:', {
            remainingCalls: rateLimitStatus.remainingCalls,
            resetInSeconds: rateLimitStatus.resetInSeconds
        });

        // Force refresh to bypass cache
        const price = await fetchRLBPrice(true);

        if (price) {
            lastSuccessfulFetch = new Date();
            consecutiveFailures = 0;
            console.log(`[Price Refresh] Successfully refreshed price: $${price.toFixed(6)} at ${lastSuccessfulFetch.toISOString()}`);
        } else {
            consecutiveFailures++;
            console.error(`[Price Refresh] Failed to fetch price (failure ${consecutiveFailures}/${MAX_FAILURES_BEFORE_ALERT})`);

            if (consecutiveFailures >= MAX_FAILURES_BEFORE_ALERT) {
                console.error(`[Price Refresh] ⚠️  ALERT: ${consecutiveFailures} consecutive price fetch failures!`);
                console.error('[Price Refresh] Last successful fetch:', lastSuccessfulFetch?.toISOString() || 'Never');
            }
        }

        // Log cache status
        const newStatus = getRateLimitStatus();
        if (newStatus.cacheStatus) {
            console.log('[Price Refresh] Cache status:', {
                price: `$${newStatus.cacheStatus.price.toFixed(6)}`,
                ageSeconds: newStatus.cacheStatus.ageSeconds,
                validForSeconds: newStatus.cacheStatus.validForSeconds
            });
        }

    } catch (error) {
        consecutiveFailures++;
        console.error('[Price Refresh] Error during price refresh:', error);

        if (consecutiveFailures >= MAX_FAILURES_BEFORE_ALERT) {
            console.error(`[Price Refresh] ⚠️  CRITICAL: ${consecutiveFailures} consecutive errors!`);
        }
    } finally {
        isRunning = false;
    }
}

/**
 * Start the background price refresh service
 */
function startPriceRefreshService() {
    if (intervalId) {
        console.log('[Price Refresh] Service already running');
        return;
    }

    console.log('[Price Refresh] Starting background service...');
    console.log(`[Price Refresh] Will refresh every ${REFRESH_INTERVAL / 1000} seconds`);

    // Run immediately on start
    refreshPrice();

    // Then run periodically
    intervalId = setInterval(refreshPrice, REFRESH_INTERVAL);
}

/**
 * Stop the background price refresh service
 */
function stopPriceRefreshService() {
    if (intervalId) {
        clearInterval(intervalId);
        intervalId = null;
        console.log('[Price Refresh] Service stopped');
    }
}

/**
 * Get service status
 */
function getPriceRefreshStatus() {
    return {
        isActive: intervalId !== null,
        lastSuccessfulFetch: lastSuccessfulFetch?.toISOString() || null,
        consecutiveFailures,
        timeSinceLastSuccess: lastSuccessfulFetch
            ? Math.floor((Date.now() - lastSuccessfulFetch.getTime()) / 1000)
            : null
    };
}

module.exports = {
    startPriceRefreshService,
    stopPriceRefreshService,
    getPriceRefreshStatus,
    refreshPrice
};
