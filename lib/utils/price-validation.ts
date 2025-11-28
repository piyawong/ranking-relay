/**
 * Price Validation Utilities
 * Validates RLB prices to catch anomalies and edge cases
 */

// Expected price range for RLB (based on historical data)
const MIN_REASONABLE_PRICE = 0.01;  // $0.01
const MAX_REASONABLE_PRICE = 1.0;   // $1.00
const MAX_PRICE_CHANGE_PERCENT = 50; // 50% change in short time is suspicious

let lastValidatedPrice: number | null = null;
let lastValidatedTime: number = 0;

/**
 * Validate if a price is reasonable
 */
export function validatePrice(price: number | null): {
    isValid: boolean;
    reason?: string;
    price?: number;
} {
    // Check for null
    if (price === null || price === undefined) {
        return {
            isValid: false,
            reason: 'Price is null or undefined'
        };
    }

    // Check for NaN
    if (isNaN(price)) {
        return {
            isValid: false,
            reason: 'Price is NaN'
        };
    }

    // Check for reasonable range
    if (price < MIN_REASONABLE_PRICE) {
        return {
            isValid: false,
            reason: `Price $${price} is below minimum reasonable price $${MIN_REASONABLE_PRICE}`
        };
    }

    if (price > MAX_REASONABLE_PRICE) {
        return {
            isValid: false,
            reason: `Price $${price} is above maximum reasonable price $${MAX_REASONABLE_PRICE}`
        };
    }

    // Check for suspicious rapid changes
    if (lastValidatedPrice !== null) {
        const now = Date.now();
        const timeDiff = (now - lastValidatedTime) / 1000; // seconds

        // Only check if less than 5 minutes apart
        if (timeDiff < 300) {
            const percentChange = Math.abs((price - lastValidatedPrice) / lastValidatedPrice * 100);

            if (percentChange > MAX_PRICE_CHANGE_PERCENT) {
                console.warn(`[Price Validation] ⚠️  Suspicious price change: ${percentChange.toFixed(2)}% in ${timeDiff.toFixed(0)}s (from $${lastValidatedPrice} to $${price})`);

                // Don't reject it, but log warning
                // Could be a real market event
            }
        }
    }

    // Update last validated price
    lastValidatedPrice = price;
    lastValidatedTime = Date.now();

    return {
        isValid: true,
        price
    };
}

/**
 * Get a safe fallback price if validation fails
 */
export function getSafeFallbackPrice(): number | null {
    // Return last known good price if recent (< 1 hour)
    if (lastValidatedPrice !== null) {
        const age = (Date.now() - lastValidatedTime) / 1000;
        if (age < 3600) {
            console.log(`[Price Validation] Using last validated price $${lastValidatedPrice} (age: ${Math.floor(age)}s)`);
            return lastValidatedPrice;
        }
    }

    return null;
}

/**
 * Validate and sanitize price before storing
 */
export function sanitizePrice(price: number | null): number | null {
    const validation = validatePrice(price);

    if (!validation.isValid) {
        console.error(`[Price Validation] ❌ Invalid price: ${validation.reason}`);
        return getSafeFallbackPrice();
    }

    return validation.price || null;
}
