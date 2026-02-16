/**
 * Analyze blocks where Bloxroute won (we lost)
 * Map with relay node locations to find patterns
 */

import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';

const prisma = new PrismaClient();

interface LossRecord {
  block_number: number;
  bloxroute_origin: string | null;
  time_difference_ms: number | null;
  first_relay_name: string;
  first_relay_latency: number;
  first_relay_arrival: string;
  bloxroute_timestamp: string | null;
  // Relay node info
  node_latitude: number | null;
  node_longitude: number | null;
  node_location: string | null;
  node_country: string | null;
  is_mapped: boolean;
}

interface LocationStats {
  location: string;
  country: string;
  latitude: number;
  longitude: number;
  loss_count: number;
  avg_time_diff_ms: number;
  relay_names: string[];
}

interface OriginStats {
  origin: string;
  loss_count: number;
  avg_time_diff_ms: number;
  locations_lost_to: string[];
}

async function main() {
  console.log('=== Analyzing Bloxroute Losses ===\n');

  // 1. Query blocks where Bloxroute won (is_win_bloxroute = true)
  console.log('Fetching 500 most recent blocks where Bloxroute won...\n');

  const lostBlocks = await prisma.block.findMany({
    where: {
      is_win_bloxroute: true,
      bloxroute_timestamp: { not: null },
    },
    orderBy: { block_number: 'desc' },
    take: 500,
    include: {
      RelayDetail: {
        where: { arrival_order: 0 }, // Get only the first (fastest) relay
        take: 1,
      },
    },
  });

  console.log(`Found ${lostBlocks.length} blocks where Bloxroute won\n`);

  if (lostBlocks.length === 0) {
    console.log('No loss data found. Exiting.');
    await prisma.$disconnect();
    return;
  }

  // 2. Get all relay nodes for mapping
  const relayNodes = await prisma.relayNode.findMany();
  const nodeMap = new Map(relayNodes.map(n => [n.name, n]));

  console.log(`Loaded ${relayNodes.length} relay nodes for mapping\n`);

  // 3. Build loss records with location data
  const lossRecords: LossRecord[] = [];

  for (const block of lostBlocks) {
    const firstRelay = block.RelayDetail[0];
    if (!firstRelay) continue;

    const node = nodeMap.get(firstRelay.relay_name);

    lossRecords.push({
      block_number: block.block_number,
      bloxroute_origin: block.origin,
      time_difference_ms: block.time_difference_ms,
      first_relay_name: firstRelay.relay_name,
      first_relay_latency: parseFloat(firstRelay.latency.toString()),
      first_relay_arrival: firstRelay.arrival_timestamp.toISOString(),
      bloxroute_timestamp: block.bloxroute_timestamp?.toISOString() || null,
      node_latitude: node ? parseFloat(node.latitude.toString()) : null,
      node_longitude: node ? parseFloat(node.longitude.toString()) : null,
      node_location: node?.location || null,
      node_country: node?.country || null,
      is_mapped: !!node,
    });
  }

  // 4. Save raw data to file
  const outputPath = '/root/Desktop/ranking-relay/bloxroute-loss-analysis.json';
  fs.writeFileSync(outputPath, JSON.stringify({
    generated_at: new Date().toISOString(),
    total_losses: lossRecords.length,
    records: lossRecords,
  }, null, 2));
  console.log(`Saved raw data to: ${outputPath}\n`);

  // 5. Analyze by location
  console.log('=== Analysis by Our Relay Location ===\n');

  const locationStats = new Map<string, LocationStats>();

  for (const record of lossRecords) {
    if (!record.is_mapped) continue;

    const key = `${record.node_location || 'Unknown'}, ${record.node_country || 'Unknown'}`;

    if (!locationStats.has(key)) {
      locationStats.set(key, {
        location: record.node_location || 'Unknown',
        country: record.node_country || 'Unknown',
        latitude: record.node_latitude!,
        longitude: record.node_longitude!,
        loss_count: 0,
        avg_time_diff_ms: 0,
        relay_names: [],
      });
    }

    const stats = locationStats.get(key)!;
    stats.loss_count++;
    if (record.time_difference_ms) {
      stats.avg_time_diff_ms += record.time_difference_ms;
    }
    if (!stats.relay_names.includes(record.first_relay_name)) {
      stats.relay_names.push(record.first_relay_name);
    }
  }

  // Calculate averages and sort
  const locationStatsArray = Array.from(locationStats.values())
    .map(s => ({
      ...s,
      avg_time_diff_ms: s.loss_count > 0 ? Math.round(s.avg_time_diff_ms / s.loss_count) : 0,
    }))
    .sort((a, b) => b.loss_count - a.loss_count);

  console.log('Top Locations Where We Lost (by our fastest relay location):');
  console.log('─'.repeat(80));
  for (const stat of locationStatsArray.slice(0, 15)) {
    console.log(`  ${stat.location}, ${stat.country}`);
    console.log(`    Losses: ${stat.loss_count} | Avg behind: ${stat.avg_time_diff_ms}ms`);
    console.log(`    Coords: (${stat.latitude.toFixed(4)}, ${stat.longitude.toFixed(4)})`);
    console.log(`    Relays: ${stat.relay_names.join(', ')}`);
    console.log('');
  }

  // 6. Analyze by Bloxroute origin
  console.log('\n=== Analysis by Bloxroute Origin ===\n');

  const originStats = new Map<string, OriginStats>();

  for (const record of lossRecords) {
    const origin = record.bloxroute_origin || 'Unknown';

    if (!originStats.has(origin)) {
      originStats.set(origin, {
        origin,
        loss_count: 0,
        avg_time_diff_ms: 0,
        locations_lost_to: [],
      });
    }

    const stats = originStats.get(origin)!;
    stats.loss_count++;
    if (record.time_difference_ms) {
      stats.avg_time_diff_ms += record.time_difference_ms;
    }

    const location = record.node_location || record.first_relay_name;
    if (!stats.locations_lost_to.includes(location)) {
      stats.locations_lost_to.push(location);
    }
  }

  const originStatsArray = Array.from(originStats.values())
    .map(s => ({
      ...s,
      avg_time_diff_ms: s.loss_count > 0 ? Math.round(s.avg_time_diff_ms / s.loss_count) : 0,
    }))
    .sort((a, b) => b.loss_count - a.loss_count);

  console.log('Bloxroute Origins (where blocks came from):');
  console.log('─'.repeat(80));
  for (const stat of originStatsArray.slice(0, 10)) {
    console.log(`  Origin: ${stat.origin}`);
    console.log(`    Losses: ${stat.loss_count} | Avg behind: ${stat.avg_time_diff_ms}ms`);
    console.log('');
  }

  // 7. Unmapped relays analysis
  const unmappedLosses = lossRecords.filter(r => !r.is_mapped);
  const unmappedRelayNames = new Map<string, number>();
  for (const record of unmappedLosses) {
    unmappedRelayNames.set(
      record.first_relay_name,
      (unmappedRelayNames.get(record.first_relay_name) || 0) + 1
    );
  }

  if (unmappedLosses.length > 0) {
    console.log('\n=== Unmapped Relays (No Location Data) ===\n');
    console.log(`Total unmapped losses: ${unmappedLosses.length}`);
    console.log('Relay names without location:');
    for (const [name, count] of Array.from(unmappedRelayNames.entries()).sort((a, b) => b[1] - a[1])) {
      console.log(`  ${name}: ${count} losses`);
    }
  }

  // 8. Generate recommendations
  console.log('\n\n');
  console.log('═'.repeat(80));
  console.log('                    RECOMMENDATIONS FOR NEW RELAY LOCATIONS');
  console.log('═'.repeat(80));
  console.log('');

  // Find gaps based on Bloxroute origins
  const topOrigins = originStatsArray.slice(0, 5);
  const existingLocations = new Set(relayNodes.map(n => n.location?.toLowerCase()));

  console.log('Based on Bloxroute origin analysis:');
  console.log('');

  for (const origin of topOrigins) {
    console.log(`🔴 Origin "${origin.origin}" - ${origin.loss_count} losses (avg ${origin.avg_time_diff_ms}ms behind)`);

    // Parse origin to suggest location
    const originLower = origin.origin.toLowerCase();
    if (originLower.includes('fra') || originLower.includes('frankfurt')) {
      console.log('   → Consider adding relay near Frankfurt, Germany');
    } else if (originLower.includes('lon') || originLower.includes('london')) {
      console.log('   → Consider adding relay near London, UK');
    } else if (originLower.includes('ams') || originLower.includes('amsterdam')) {
      console.log('   → Consider adding relay near Amsterdam, Netherlands');
    } else if (originLower.includes('sin') || originLower.includes('singapore')) {
      console.log('   → Consider adding relay near Singapore');
    } else if (originLower.includes('par') || originLower.includes('paris')) {
      console.log('   → Consider adding relay near Paris, France');
    } else if (originLower.includes('nyc') || originLower.includes('new york')) {
      console.log('   → Consider adding relay near New York, USA');
    } else if (originLower.includes('tok') || originLower.includes('tokyo')) {
      console.log('   → Consider adding relay near Tokyo, Japan');
    } else {
      console.log(`   → Research infrastructure near: ${origin.origin}`);
    }
    console.log('');
  }

  // Geographic analysis
  console.log('\nBased on geographic gap analysis:');
  console.log('');

  const mappedLosses = lossRecords.filter(r => r.is_mapped);
  if (mappedLosses.length > 0) {
    // Find centroid of losses
    let avgLat = 0, avgLng = 0;
    for (const record of mappedLosses) {
      avgLat += record.node_latitude!;
      avgLng += record.node_longitude!;
    }
    avgLat /= mappedLosses.length;
    avgLng /= mappedLosses.length;

    console.log(`📍 Average loss centroid: (${avgLat.toFixed(4)}, ${avgLng.toFixed(4)})`);
    console.log('   This is approximately in Western Europe');
    console.log('');

    // Check for major data center regions
    const majorHubs = [
      { name: 'Frankfurt, Germany', lat: 50.1109, lng: 8.6821 },
      { name: 'Amsterdam, Netherlands', lat: 52.3676, lng: 4.9041 },
      { name: 'London, UK', lat: 51.5074, lng: -0.1278 },
      { name: 'Paris, France', lat: 48.8566, lng: 2.3522 },
      { name: 'Zurich, Switzerland', lat: 47.3769, lng: 8.5417 },
      { name: 'Dublin, Ireland', lat: 53.3498, lng: -6.2603 },
    ];

    console.log('Major Ethereum infrastructure hubs to consider:');
    for (const hub of majorHubs) {
      const hasRelay = relayNodes.some(n =>
        n.location?.toLowerCase().includes(hub.name.split(',')[0].toLowerCase())
      );
      const distance = Math.sqrt(
        Math.pow(hub.lat - avgLat, 2) + Math.pow(hub.lng - avgLng, 2)
      ) * 111; // Rough km conversion

      console.log(`  ${hasRelay ? '✅' : '❌'} ${hub.name} (${Math.round(distance)}km from loss centroid)`);
    }
  }

  console.log('\n');
  console.log('═'.repeat(80));

  // Save analysis summary
  const summaryPath = '/root/Desktop/ranking-relay/bloxroute-loss-summary.json';
  fs.writeFileSync(summaryPath, JSON.stringify({
    generated_at: new Date().toISOString(),
    total_losses_analyzed: lossRecords.length,
    mapped_losses: lossRecords.filter(r => r.is_mapped).length,
    unmapped_losses: lossRecords.filter(r => !r.is_mapped).length,
    by_location: locationStatsArray,
    by_origin: originStatsArray,
    existing_relay_nodes: relayNodes.map(n => ({
      name: n.name,
      location: n.location,
      country: n.country,
      latitude: parseFloat(n.latitude.toString()),
      longitude: parseFloat(n.longitude.toString()),
    })),
  }, null, 2));

  console.log(`\nSummary saved to: ${summaryPath}`);

  await prisma.$disconnect();
}

main().catch(console.error);
