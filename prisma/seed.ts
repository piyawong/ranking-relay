import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'crypto';

const prisma = new PrismaClient();

async function main() {
  console.log('Start seeding...');

  // Clean existing data
  await prisma.relayDetail.deleteMany();
  await prisma.block.deleteMany();
  await prisma.relayStatistics.deleteMany();

  // Create sample blocks with relay details
  const relayNames = ['relay-alpha', 'relay-beta', 'relay-gamma', 'relay-delta', 'relay-epsilon'];

  for (let blockNum = 1000; blockNum <= 1010; blockNum++) {
    // Randomize relay order for each block
    const shuffled = [...relayNames].sort(() => Math.random() - 0.5);

    // Base timestamp for this block
    const baseTimestamp = new Date(Date.now() - (1010 - blockNum) * 60000); // Each block is ~1 min apart
    const now = new Date();

    const block = await prisma.block.create({
      data: {
        id: randomUUID(),
        block_number: blockNum,
        updated_at: now,
        RelayDetail: {
          create: shuffled.map((name, index) => ({
            id: randomUUID(),
            relay_name: name,
            latency: parseFloat((10 + Math.random() * 20).toFixed(2)),
            loss: parseFloat((Math.random() * 2).toFixed(2)),
            arrival_order: index,
            arrival_timestamp: new Date(baseTimestamp.getTime() + index * 100), // Each relay arrives 100ms apart
            ranking_score: parseFloat((index * 50 + (10 + Math.random() * 20) * 0.3 + Math.random() * 2 * 0.2).toFixed(2))
          }))
        }
      },
      include: {
        RelayDetail: true
      }
    });

    console.log(`Created block ${block.block_number} with ${block.RelayDetail.length} relays`);
  }

  // Create relay statistics
  for (const relayName of relayNames) {
    const relayDetails = await prisma.relayDetail.findMany({
      where: { relay_name: relayName }
    });

    const avgLatency = relayDetails.reduce((sum, r) => sum + parseFloat(r.latency.toString()), 0) / relayDetails.length;
    const avgLoss = relayDetails.reduce((sum, r) => sum + parseFloat(r.loss.toString()), 0) / relayDetails.length;
    const firstArrivalCount = relayDetails.filter(r => r.arrival_order === 0).length;

    await prisma.relayStatistics.create({
      data: {
        id: randomUUID(),
        relay_name: relayName,
        total_blocks: relayDetails.length,
        avg_latency: parseFloat(avgLatency.toFixed(2)),
        avg_loss: parseFloat(avgLoss.toFixed(2)),
        first_arrival_count: firstArrivalCount,
        last_updated: new Date()
      }
    });

    console.log(`Created statistics for ${relayName}`);
  }

  console.log('Seeding finished.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
