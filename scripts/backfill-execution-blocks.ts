/**
 * Backfill execution block numbers for existing slots
 * Queries beacon node to get execution block height for each slot
 */

import { prisma } from '../lib/db/prisma';
import { getBlockHashFromSlot } from '../lib/utils/fetch-block-data';

async function backfillExecutionBlocks() {
  console.log('=== Backfilling Execution Block Numbers ===\n');

  try {
    // Get all blocks without execution_block_number
    const blocksWithoutExecNum = await prisma.block.findMany({
      where: { execution_block_number: null },
      orderBy: { block_number: 'desc' },
      take: 100  // Process 100 at a time
    });

    console.log(`Found ${blocksWithoutExecNum.length} slots without execution block numbers`);

    if (blocksWithoutExecNum.length === 0) {
      console.log('\n✓ All slots already have execution block numbers!');
      return;
    }

    let updated = 0;
    let failed = 0;

    for (const block of blocksWithoutExecNum) {
      try {
        console.log(`Processing slot ${block.block_number}...`);

        // Query beacon node for slot info
        const slotInfo = await getBlockHashFromSlot(block.block_number);

        if (slotInfo && slotInfo.executionBlockNumber) {
          // Update block with execution block number
          await prisma.block.update({
            where: { id: block.id },
            data: { execution_block_number: slotInfo.executionBlockNumber }
          });

          console.log(`  ✓ Slot ${block.block_number} → Block height ${slotInfo.executionBlockNumber}`);
          updated++;
        } else {
          console.log(`  ✗ Could not fetch execution block for slot ${block.block_number}`);
          failed++;
        }

        // Small delay to avoid overwhelming beacon node
        await new Promise(resolve => setTimeout(resolve, 100));

      } catch (error) {
        console.error(`  ✗ Error processing slot ${block.block_number}:`, error);
        failed++;
      }
    }

    console.log(`\n=== Backfill Complete ===`);
    console.log(`Updated: ${updated}`);
    console.log(`Failed: ${failed}`);

  } catch (error) {
    console.error('\n❌ Error during backfill:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

backfillExecutionBlocks()
  .then(() => {
    console.log('\n✓ Script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Script failed:', error);
    process.exit(1);
  });
