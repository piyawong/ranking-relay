/**
 * Smart purge - finds ALL anomalous snapshots compared to baseline
 * and deletes them in ONE operation.
 *
 * Usage: npx tsx scripts/purge-all-anomalies.ts [--dry-run]
 */

import { PrismaClient, Decimal } from '@prisma/client';

const prisma = new PrismaClient();

function decimalToNumber(val: Decimal | number | null): number {
  if (val === null) return 0;
  if (typeof val === 'number') return val;
  return parseFloat(val.toString());
}

async function main() {
  const dryRun = process.argv.includes('--dry-run');

  console.log('='.repeat(50));
  console.log('Smart Anomaly Purge');
  console.log(`Mode: ${dryRun ? 'DRY RUN' : 'LIVE DELETE'}`);
  console.log('='.repeat(50));

  // Get all snapshots
  const snapshots = await prisma.balanceSnapshot.findMany({
    orderBy: { timestamp: 'asc' },
    select: {
      id: true,
      timestamp: true,
      onsite_usd: true,
      onchain_usdt: true,
      onsite_rlb: true,
      onchain_rlb: true
    }
  });

  console.log(`Total snapshots: ${snapshots.length}`);

  if (snapshots.length < 10) {
    console.log('Not enough data to determine baseline');
    return;
  }

  // Calculate totals for each snapshot
  const totals = snapshots.map(s => ({
    id: s.id,
    timestamp: s.timestamp,
    usdUsdt: decimalToNumber(s.onsite_usd) + decimalToNumber(s.onchain_usdt),
    rlb: decimalToNumber(s.onsite_rlb) + decimalToNumber(s.onchain_rlb)
  }));

  // Find baseline using median
  const sortedUsdUsdt = [...totals].sort((a, b) => a.usdUsdt - b.usdUsdt);
  const sortedRlb = [...totals].sort((a, b) => a.rlb - b.rlb);

  const medianUsdUsdt = sortedUsdUsdt[Math.floor(sortedUsdUsdt.length / 2)].usdUsdt;
  const medianRlb = sortedRlb[Math.floor(sortedRlb.length / 2)].rlb;

  console.log(`\nBaseline (median):`);
  console.log(`  USDT/USD: ${medianUsdUsdt.toFixed(2)}`);
  console.log(`  RLB: ${medianRlb.toFixed(2)}`);

  // Thresholds
  const thresholdUsdt = 300;
  const thresholdRlb = 999;

  // Find ALL anomalous snapshots (deviate from baseline)
  const anomalies = totals.filter(t => {
    const usdtDiff = Math.abs(t.usdUsdt - medianUsdUsdt);
    const rlbDiff = Math.abs(t.rlb - medianRlb);
    return usdtDiff > thresholdUsdt || rlbDiff > thresholdRlb;
  });

  console.log(`\nFound ${anomalies.length} anomalous snapshots`);

  if (anomalies.length === 0) {
    console.log('✅ No anomalies to delete!');
    return;
  }

  // Show time ranges
  const firstAnomaly = anomalies[0];
  const lastAnomaly = anomalies[anomalies.length - 1];
  console.log(`\nAnomaly time range:`);
  console.log(`  First: ${firstAnomaly.timestamp.toISOString()}`);
  console.log(`  Last: ${lastAnomaly.timestamp.toISOString()}`);

  // Group by consecutive ranges
  let ranges: { start: Date; end: Date; count: number }[] = [];
  let currentRange: { start: Date; end: Date; count: number } | null = null;

  for (let i = 0; i < anomalies.length; i++) {
    const current = anomalies[i];
    const prev = i > 0 ? anomalies[i - 1] : null;

    // Check if this is part of a consecutive sequence (within 1 minute of prev)
    const isConsecutive = prev &&
      (current.timestamp.getTime() - prev.timestamp.getTime()) < 60000;

    if (isConsecutive && currentRange) {
      currentRange.end = current.timestamp;
      currentRange.count++;
    } else {
      if (currentRange) {
        ranges.push(currentRange);
      }
      currentRange = {
        start: current.timestamp,
        end: current.timestamp,
        count: 1
      };
    }
  }
  if (currentRange) {
    ranges.push(currentRange);
  }

  console.log(`\nAnomaly ranges: ${ranges.length}`);
  ranges.forEach((r, i) => {
    console.log(`  Range ${i + 1}: ${r.start.toISOString()} - ${r.end.toISOString()} (${r.count} snapshots)`);
  });

  if (dryRun) {
    console.log('\n[DRY RUN] Would delete these snapshots');
    return;
  }

  // DELETE ALL at once
  const anomalyIds = anomalies.map(a => a.id);

  console.log(`\nDeleting ${anomalyIds.length} snapshots...`);

  const result = await prisma.balanceSnapshot.deleteMany({
    where: {
      id: { in: anomalyIds }
    }
  });

  console.log(`\n✅ Deleted ${result.count} snapshots!`);

  // Verify
  const remaining = await prisma.balanceSnapshot.count();
  console.log(`Remaining snapshots: ${remaining}`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
