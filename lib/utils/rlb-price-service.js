/**
 * RLB Price Service (JavaScript version)
 * Centralized service for fetching RLB prices with retries and caching
 * Respects CoinGecko rate limits: 30 calls/minute for demo API keys
 *
 * Uses file-based cache to share state between server.js and Next.js API routes
 */

const fs = require('fs');
const path = require('path');

const COINGECKO_API_KEY = 'CG-sK5YVaYp1qWL6ECbMVguVYW1';
const CACHE_DURATION = 3600; // Cache for 1 hour (3600 seconds) to reduce API calls
const MAX_STALE_AGE = 7200; // Maximum 2 hours before cache is considered too stale
const MAX_RETRIES = 3;
const RETRY_DELAY = 2000; // 2 seconds between retries
const MIN_FETCH_INTERVAL = 2000; // Minimum 2 seconds between API calls

// File-based cache path (shared between server.js and Next.js)
const CACHE_FILE = '/tmp/rlb-price-cache.json';

/**
 * Read cache from file
 */
function readCacheFromFile() {
    try {
        if (fs.existsSync(CACHE_FILE)) {
            const data = fs.readFileSync(CACHE_FILE, 'utf8');
            return JSON.parse(data);
        }
    } catch (error) {
        console.error('[RLB Price Service] Error reading cache file:', error.message);
    }
    return null;
}

/**
 * Write cache to file
 */
function writeCacheToFile(cache) {
    try {
        fs.writeFileSync(CACHE_FILE, JSON.stringify(cache), 'utf8');
    } catch (error) {
        console.error('[RLB Price Service] Error writing cache file:', error.message);
    }
}

// In-memory cache (for rate limiting only, price cache is file-based)
let priceCache = null;

// Rate limiting tracking
let lastApiCallTime = 0;
let apiCallCount = 0;
let apiCallWindowStart = Date.now();

// Helper function to sleep
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Check if we should wait before making an API call (rate limiting)
 */
async function enforceRateLimit() {
    const now = Date.now();

    // Reset counter if minute window has passed
    if (now - apiCallWindowStart > 60000) {
        apiCallCount = 0;
        apiCallWindowStart = now;
    }

    // If we're approaching the rate limit (25 calls to be safe), wait
    if (apiCallCount >= 25) {
        const waitTime = 60000 - (now - apiCallWindowStart);
        if (waitTime > 0) {
            console.log(`[RLB Price Service] Rate limit approaching, waiting ${waitTime}ms`);
            await sleep(waitTime);
            apiCallCount = 0;
            apiCallWindowStart = Date.now();
        }
    }

    // Ensure minimum interval between calls
    const timeSinceLastCall = now - lastApiCallTime;
    if (timeSinceLastCall < MIN_FETCH_INTERVAL) {
        const waitTime = MIN_FETCH_INTERVAL - timeSinceLastCall;
        console.log(`[RLB Price Service] Enforcing minimum interval, waiting ${waitTime}ms`);
        await sleep(waitTime);
    }
}

/**
 * Fetch RLB price from CoinGecko with automatic retries
 * @param {boolean} forceRefresh - Force bypass cache even if valid
 * @returns {Promise<number|null>} RLB price in USD or null if all attempts fail
 */
async function fetchRLBPrice(forceRefresh = false) {
    const now = Date.now();

    // Read from file-based cache (shared across processes)
    const fileCache = readCacheFromFile();

    // Return cached price if still valid (unless force refresh)
    if (!forceRefresh && fileCache && (now - fileCache.lastUpdated) < CACHE_DURATION * 1000) {
        console.log('[RLB Price Service] Returning cached price: $' + fileCache.price.toFixed(6) + ' (cache age: ' + Math.floor((now - fileCache.lastUpdated) / 1000) + 's)');
        return fileCache.price;
    }

    // Use file cache as fallback reference
    priceCache = fileCache;

    let lastError = null;

    // Try multiple times with exponential backoff
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
            // Enforce rate limiting before making API call
            await enforceRateLimit();

            console.log(`[RLB Price Service] Fetching price from CoinGecko (attempt ${attempt}/${MAX_RETRIES})...`);

            // Track this API call
            lastApiCallTime = Date.now();
            apiCallCount++;

            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 10000);

            const response = await fetch(
                'https://api.coingecko.com/api/v3/simple/price?ids=rollbit-coin&vs_currencies=usd&include_last_updated_at=true',
                {
                    headers: {
                        'Accept': 'application/json',
                        'x-cg-demo-api-key': COINGECKO_API_KEY,
                    },
                    signal: controller.signal
                }
            );

            clearTimeout(timeoutId);

            if (!response.ok) {
                const errorText = await response.text();

                // If rate limited and we have fresh cache (< 1 hour old), return it
                if (response.status === 429 && priceCache) {
                    const cacheAge = (Date.now() - priceCache.lastUpdated) / 1000;
                    if (cacheAge < MAX_STALE_AGE) {
                        console.log(`[RLB Price Service] Rate limited, returning cached price (age: ${Math.floor(cacheAge)}s)`);
                        return priceCache.price;
                    }
                    console.warn(`[RLB Price Service] Rate limited but cache too old (${Math.floor(cacheAge)}s), will retry`);
                }

                throw new Error(`CoinGecko API error: ${response.status} - ${errorText}`);
            }

            const data = await response.json();
            const price = data['rollbit-coin']?.usd;

            if (typeof price !== 'number' || price <= 0) {
                throw new Error(`Invalid price received: ${price}`);
            }

            // Update cache (both in-memory and file)
            priceCache = {
                price,
                timestamp: new Date().toISOString(),
                lastUpdated: Date.now()  // Use current time, not stale 'now'
            };
            writeCacheToFile(priceCache);

            console.log(`[RLB Price Service] Successfully fetched price: $${price}`);
            return price;

        } catch (error) {
            lastError = error;
            console.error(`[RLB Price Service] Attempt ${attempt} failed:`, error.message);

            // If not the last attempt, wait before retrying
            if (attempt < MAX_RETRIES) {
                const delay = RETRY_DELAY * Math.pow(2, attempt - 1); // Exponential backoff
                console.log(`[RLB Price Service] Waiting ${delay}ms before retry...`);
                await sleep(delay);
            }
        }
    }

    // All attempts failed, return cached value if not too old (< 1 hour)
    if (priceCache) {
        const cacheAge = (Date.now() - priceCache.lastUpdated) / 1000;
        if (cacheAge < MAX_STALE_AGE) {
            console.warn(`[RLB Price Service] All attempts failed, returning cached price (age: ${Math.floor(cacheAge)}s)`);
            return priceCache.price;
        }
        console.error(`[RLB Price Service] Cache too old (${Math.floor(cacheAge)}s > ${MAX_STALE_AGE}s), refusing to use stale data`);
    }

    console.error('[RLB Price Service] Failed to fetch price after all attempts:', lastError?.message);
    return null;
}

/**
 * Get cached price without fetching (for quick checks)
 */
function getCachedRLBPrice() {
    const fileCache = readCacheFromFile();
    return fileCache?.price || null;
}

/**
 * Clear the price cache (useful for testing)
 */
function clearPriceCache() {
    priceCache = null;
    try {
        if (fs.existsSync(CACHE_FILE)) {
            fs.unlinkSync(CACHE_FILE);
        }
    } catch (error) {
        console.error('[RLB Price Service] Error clearing cache file:', error.message);
    }
}

/**
 * Get current rate limit status
 */
function getRateLimitStatus() {
    const now = Date.now();
    const windowAge = now - apiCallWindowStart;
    const remainingCalls = Math.max(0, 25 - apiCallCount);
    const resetIn = Math.max(0, 60000 - windowAge);

    // Read from file cache for accurate status
    const fileCache = readCacheFromFile();

    return {
        callsInWindow: apiCallCount,
        remainingCalls,
        resetInMs: resetIn,
        resetInSeconds: Math.ceil(resetIn / 1000),
        cacheStatus: fileCache ? {
            price: fileCache.price,
            ageSeconds: Math.floor((now - fileCache.lastUpdated) / 1000),
            validForSeconds: Math.max(0, Math.floor((CACHE_DURATION * 1000 - (now - fileCache.lastUpdated)) / 1000))
        } : null
    };
}

module.exports = {
    fetchRLBPrice,
    getCachedRLBPrice,
    clearPriceCache,
    getRateLimitStatus
};
