# RLB Price System - Edge Cases & Protections

## Overview
This document outlines all edge cases for the RLB price fetching system and the protections in place.

---

## ✅ Edge Cases with Protection

### 1. **CoinGecko API Failure (Extended Outage)**
**Scenario:** CoinGecko API is down for hours

**Protection:**
- ✅ 3 retry attempts with exponential backoff (2s, 4s, 8s)
- ✅ Falls back to cached price if < 1 hour old
- ✅ After 1 hour, refuses stale cache and returns `null`
- ✅ Background services keep trying every 60 seconds
- ✅ Backfill service catches any NULL prices every 5 minutes

**Result:** Maximum 1 hour of stale data, then NULLs that get backfilled later

---

### 2. **CoinGecko Rate Limiting (429 Error)**
**Scenario:** Hit 30 calls/minute limit

**Protection:**
- ✅ Rate limit tracker (max 25 calls/min to stay safe)
- ✅ Enforces 2-second minimum between calls
- ✅ If rate limited, uses cached price (< 1 hour)
- ✅ Automatically resets counter every 60 seconds

**Result:** Never hits rate limit; gracefully uses cache if it does

---

### 3. **Invalid/Corrupt Price Data**
**Scenario:** CoinGecko returns invalid data (NaN, negative, extreme spike)

**Protection:**
- ✅ Validates `typeof price === 'number' && price > 0`
- ✅ Range check: $0.01 - $1.00 (reasonable for RLB)
- ✅ Spike detection: warns on >50% change in <5 minutes
- ✅ Falls back to last validated price if anomaly detected

**File:** `lib/utils/price-validation.{ts,js}`

**Result:** Bad data is rejected; uses last known good price

---

### 4. **Snapshot Created with NULL Price**
**Scenario:** All price fetches fail, snapshot gets `rlb_price_usd: null`

**Protection:**
- ✅ Socket server logs warning when creating NULL price snapshot
- ✅ Price validation returns last good price as fallback (< 1 hour)
- ✅ Backfill service runs every 5 minutes to catch NULLs
- ✅ Backfill catches snapshots from last 24 hours

**Result:** NULL snapshots are backfilled within 5 minutes

---

### 5. **Container Restart / In-Memory Cache Lost**
**Scenario:** Docker container restarts, cache is empty

**Protection:**
- ✅ Background services auto-start on container boot
- ✅ First price fetch happens immediately (within 1 second)
- ✅ Cache repopulates on first successful fetch
- ✅ Price validation keeps last validated price as backup

**Result:** Fresh price fetched within 1 second of startup

---

### 6. **API Key Expiration/Invalid**
**Scenario:** CoinGecko API key stops working

**Current:** Returns 401 error, falls back to cache, then NULLs
**Monitoring:** Logs show repeated 401 errors

**Recommendation:**
- Monitor logs for repeated API errors
- Consider alerting on >10 consecutive failures

---

### 7. **Network Timeout**
**Scenario:** Network connection to CoinGecko times out

**Protection:**
- ✅ 10-second timeout on fetch requests
- ✅ AbortController cancels hung requests
- ✅ Retries with exponential backoff
- ✅ Falls back to cached price

**Result:** Maximum 30 seconds of retries, then uses cache

---

### 8. **Database Connection Failure During Backfill**
**Scenario:** Prisma can't connect to PostgreSQL during backfill

**Current:** Error is logged, backfill aborts
**Protection:** Service retries on next cycle (5 minutes later)

**Recommendation:**
- Add retry logic within backfill function
- Alert on repeated database errors

---

### 9. **Price Data Gap Detection**
**Scenario:** Time gaps between snapshots (>5 minutes)

**Current Status:** 9 gaps in last 24 hours (normal for beacon chain data)
**Protection:** Not needed - gaps are expected when no blocks

---

### 10. **Concurrent Price Fetches (Multiple Container Instances)**
**Scenario:** Running multiple webapp containers, all fetching prices

**Current:** Each container fetches independently
**Impact:** Could hit rate limits faster (25 calls/min × N containers)

**Recommendation:**
- For multi-container: use shared Redis cache
- Or: designate one container as "price leader"

---

## Current Protections Summary

| Edge Case | Detection | Auto-Recovery | Alert |
|-----------|-----------|---------------|-------|
| API Failure | ✅ Retry logic | ✅ Cache fallback | ⚠️ Logs only |
| Rate Limit | ✅ Tracker | ✅ Auto-wait | ⚠️ Logs only |
| Invalid Data | ✅ Validation | ✅ Fallback price | ⚠️ Logs only |
| NULL Prices | ✅ Backfill scans | ✅ Auto-backfill | ⚠️ Logs only |
| Cache Stale | ✅ Age check | ✅ Background refresh | ✅ Refuses >1hr |
| Network Timeout | ✅ AbortController | ✅ Retry + cache | ⚠️ Logs only |
| Container Restart | ✅ Auto-start | ✅ Immediate fetch | N/A |

---

## Monitoring Checklist

To ensure the system is healthy, monitor for:

1. **Consecutive Fetch Failures**
   - Alert if >5 consecutive failures
   - Check: `[Price Refresh] ⚠️  ALERT` in logs

2. **NULL Price Snapshots**
   - Query: `SELECT COUNT(*) FROM BalanceSnapshot WHERE rlb_price_usd IS NULL`
   - Should be 0 or very few

3. **Price Staleness**
   - Check cache age in `/api/balance/price`
   - Alert if `cacheAge > 300` seconds

4. **API Errors**
   - Watch for: `CoinGecko API error: 401` (bad key)
   - Watch for: `CoinGecko API error: 429` (rate limit)

5. **Service Health**
   - Check logs for: `[Price Refresh] Starting background service`
   - Check logs for: `[Price Backfill] Starting background service`

---

## Recovery Procedures

### If Prices Become Stale:
1. Check if services are running: `docker compose logs webapp | grep "Price Refresh\|Price Backfill"`
2. Check CoinGecko API: `curl "https://api.coingecko.com/api/v3/simple/price?ids=rollbit-coin&vs_currencies=usd"`
3. Restart container: `docker compose restart webapp`
4. Run manual backfill: `npx tsx scripts/backfill-historical-rlb-prices.ts`

### If NULL Prices Accumulate:
1. Run backfill service manually: `npx tsx -e "import('./lib/services/price-backfill-service').then(s => s.runBackfillOnce())"`
2. Check for database connection issues
3. Verify CoinGecko API is accessible

---

## Files

**Core Services:**
- `lib/utils/rlb-price-service.{ts,js}` - Price fetching with retry/cache
- `lib/services/price-refresh-service.{ts,js}` - Background refresh (every 60s)
- `lib/services/price-backfill-service.{ts,js}` - NULL detection & backfill (every 5min)

**Protection Layers:**
- `lib/utils/price-validation.{ts,js}` - Anomaly detection & validation
- `lib/socket/server.ts` - Uses validation when creating snapshots

**Scripts:**
- `scripts/backfill-historical-rlb-prices.ts` - Manual historical backfill
