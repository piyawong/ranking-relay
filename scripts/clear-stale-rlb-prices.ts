/**
 * Script to clear stale RLB prices from November 21, 2025 13:47 onwards
 * These prices were stuck at $0.055257 due to cache persistence issue
 * After clearing, they will be automatically backfilled with fresh prices
 */

import { prisma } from '../lib/db/prisma';

async function clearStaleRLBPrices() {
    console.log('=== Clearing Stale RLB Prices ===\n');

    // November 21, 2025 13:47 UTC (when stale price $0.055257 started)
    const staleStartDate = new Date('2025-11-21T13:47:00Z');

    console.log(`Clearing RLB prices from: ${staleStartDate.toISOString()}`);
    console.log('This will set rlb_price_usd to NULL for affected records\n');

    try {
        // First, let's check how many records will be affected
        const affectedCount = await prisma.balanceSnapshot.count({
            where: {
                timestamp: {
                    gte: staleStartDate
                },
                rlb_price_usd: {
                    not: null
                }
            }
        });

        console.log(`Found ${affectedCount} snapshots with RLB prices after ${staleStartDate.toISOString()}`);

        if (affectedCount === 0) {
            console.log('\n✓ No snapshots to clear');
            return;
        }

        // Get a sample of the stale price to show what we're clearing
        const sampleSnapshots = await prisma.balanceSnapshot.findMany({
            where: {
                timestamp: {
                    gte: staleStartDate
                },
                rlb_price_usd: {
                    not: null
                }
            },
            take: 5,
            orderBy: { timestamp: 'asc' },
            select: {
                timestamp: true,
                rlb_price_usd: true
            }
        });

        console.log('\nSample of prices to be cleared:');
        sampleSnapshots.forEach(s => {
            console.log(`  ${s.timestamp.toISOString()}: $${s.rlb_price_usd}`);
        });

        // Ask for confirmation
        console.log('\nProceeding to clear these prices...');

        // Clear the stale prices
        const result = await prisma.balanceSnapshot.updateMany({
            where: {
                timestamp: {
                    gte: staleStartDate
                },
                rlb_price_usd: {
                    not: null
                }
            },
            data: {
                rlb_price_usd: null
            }
        });

        console.log(`\n✓ Successfully cleared ${result.count} stale RLB prices`);
        console.log('You can now run the backfill script to populate with correct prices');

        // Show the count of snapshots that now need backfilling
        const needsBackfill = await prisma.balanceSnapshot.count({
            where: {
                rlb_price_usd: null
            }
        });

        console.log(`\nTotal snapshots needing RLB price backfill: ${needsBackfill}`);

    } catch (error) {
        console.error('\n✗ Error clearing stale prices:', error);
        process.exit(1);
    } finally {
        await prisma.$disconnect();
    }

    console.log('\n✓ Script completed successfully');
}

// Run the script
clearStaleRLBPrices().catch(error => {
    console.error('Unhandled error:', error);
    process.exit(1);
});