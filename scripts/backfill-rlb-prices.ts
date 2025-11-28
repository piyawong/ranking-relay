/**
 * Backfill RLB prices for historical snapshots
 *
 * Fetches historical RLB prices from CoinGecko and updates snapshots
 * that don't have rlb_price_usd set.
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const COINGECKO_API_KEY = 'CG-sK5YVaYp1qWL6ECbMVguVYW1';
const BATCH_SIZE = 100;
const DELAY_BETWEEN_BATCHES = 2000; // 2 seconds to respect rate limits

interface CoinGeckoPricePoint {
  timestamp: number; // milliseconds
  price: number;
}

/**
 * Fetch historical RLB prices from CoinGecko
 */
async function fetchHistoricalPrices(days: number = 30): Promise<CoinGeckoPricePoint[]> {
  console.log(`Fetching historical RLB prices for last ${days} days from CoinGecko...`);

  // Don't specify interval - API automatically gives hourly data for 2-90 days
  const response = await fetch(
    `https://api.coingecko.com/api/v3/coins/rollbit-coin/market_chart?vs_currency=usd&days=${days}`,
    {
      headers: {
        'Accept': 'application/json',
        'x-cg-demo-api-key': COINGECKO_API_KEY,
      }
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`CoinGecko API error: ${response.status} - ${errorText}`);
  }

  const data = await response.json();

  if (!data.prices || !Array.isArray(data.prices)) {
    throw new Error('Invalid response format from CoinGecko');
  }

  const prices: CoinGeckoPricePoint[] = data.prices.map(([timestamp, price]: [number, number]) => ({
    timestamp,
    price
  }));

  console.log(`✓ Fetched ${prices.length} historical price points`);
  return prices;
}

/**
 * Find the closest price for a given timestamp
 */
function findClosestPrice(timestamp: Date, historicalPrices: CoinGeckoPricePoint[]): number | null {
  const targetTime = timestamp.getTime();

  let closest: CoinGeckoPricePoint | null = null;
  let minDiff = Infinity;

  for (const pricePoint of historicalPrices) {
    const diff = Math.abs(pricePoint.timestamp - targetTime);
    if (diff < minDiff) {
      minDiff = diff;
      closest = pricePoint;
    }
  }

  return closest?.price || null;
}

/**
 * Main backfill function
 */
async function backfillPrices() {
  try {
    console.log('=== RLB Price Backfill Script ===\n');

    // Get count of snapshots without prices
    const totalSnapshots = await prisma.balanceSnapshot.count();
    const snapshotsWithoutPrice = await prisma.balanceSnapshot.count({
      where: { rlb_price_usd: null }
    });

    console.log(`Total snapshots: ${totalSnapshots}`);
    console.log(`Without RLB price: ${snapshotsWithoutPrice} (${((snapshotsWithoutPrice / totalSnapshots) * 100).toFixed(1)}%)`);

    if (snapshotsWithoutPrice === 0) {
      console.log('\n✓ All snapshots already have RLB prices!');
      return;
    }

    console.log('\nFetching historical prices from CoinGecko...');
    const historicalPrices = await fetchHistoricalPrices(30); // Get last 30 days (covers our 8-day range)

    console.log(`\nProcessing ${snapshotsWithoutPrice} snapshots in batches of ${BATCH_SIZE}...`);

    let processed = 0;
    let updated = 0;
    let skipped = 0;

    while (processed < snapshotsWithoutPrice) {
      // Fetch batch of snapshots without price
      const snapshots = await prisma.balanceSnapshot.findMany({
        where: { rlb_price_usd: null },
        take: BATCH_SIZE,
        orderBy: { timestamp: 'asc' }
      }).catch(async (error) => {
        console.log('  ⚠️ Database connection lost, reconnecting...');
        await prisma.$connect();
        return prisma.balanceSnapshot.findMany({
          where: { rlb_price_usd: null },
          take: BATCH_SIZE,
          orderBy: { timestamp: 'asc' }
        });
      });

      if (snapshots.length === 0) break;

      console.log(`\nBatch ${Math.floor(processed / BATCH_SIZE) + 1}: Processing ${snapshots.length} snapshots...`);

      for (const snapshot of snapshots) {
        const price = findClosestPrice(snapshot.timestamp, historicalPrices);

        if (price) {
          await prisma.balanceSnapshot.update({
            where: { id: snapshot.id },
            data: { rlb_price_usd: price }
          });
          updated++;
        } else {
          skipped++;
        }

        processed++;

        // Progress indicator
        if (processed % 500 === 0) {
          console.log(`  Progress: ${processed}/${snapshotsWithoutPrice} (${((processed / snapshotsWithoutPrice) * 100).toFixed(1)}%)`);
        }
      }

      // Delay between batches to avoid overwhelming the database
      if (processed < snapshotsWithoutPrice) {
        await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_BATCHES));
      }
    }

    console.log('\n=== Backfill Complete ===');
    console.log(`Total processed: ${processed}`);
    console.log(`Successfully updated: ${updated}`);
    console.log(`Skipped (no matching price): ${skipped}`);
    console.log(`Completion: ${((updated / snapshotsWithoutPrice) * 100).toFixed(1)}%`);

  } catch (error) {
    console.error('\n❌ Error during backfill:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run the backfill
backfillPrices()
  .then(() => {
    console.log('\n✓ Script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Script failed:', error);
    process.exit(1);
  });
