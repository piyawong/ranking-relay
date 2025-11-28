import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';

/**
 * Fetch slot number from block height using Beaconcha.in API
 *
 * Args:
 *   blockHeight: Execution block number (height)
 *
 * Returns:
 *   Object with slot info or null if not found
 */
async function getSlotFromBlockHeight(blockHeight: number): Promise<{
  slot: number;
  epoch: number;
  blockHash: string;
  relayTag?: string;
} | null> {
  try {
    const apiKey = process.env.BEACONCHAIN_API_KEY;
    const url = `https://beaconcha.in/api/v1/execution/block/${blockHeight}${apiKey ? `?apikey=${apiKey}` : ''}`;

    const response = await fetch(url, {
      headers: { 'Accept': 'application/json' },
      cache: 'no-store'
    });

    if (!response.ok) {
      console.error(`Beaconcha.in API error: ${response.status}`);
      return null;
    }

    const data = await response.json();

    if (data.status !== 'OK' || !data.data || data.data.length === 0) {
      console.error(`Block ${blockHeight} not found on beaconcha.in`);
      return null;
    }

    const blockData = data.data[0];
    const posConsensus = blockData.posConsensus;

    if (!posConsensus) {
      return null;
    }

    return {
      slot: posConsensus.slot,
      epoch: posConsensus.epoch,
      blockHash: blockData.blockHash,
      relayTag: blockData.relay?.tag
    };
  } catch (error) {
    console.error('Error fetching from Beaconcha.in:', error);
    return null;
  }
}

/**
 * GET /api/trades/enrich?block_height=23865618
 * Enriches trade data with slot number, relay info, and BloXroute comparison
 *
 * Uses Beaconcha.in API to convert block height → slot
 * Then looks up our database for relay/bloxroute comparison data
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const blockHeight = searchParams.get('block_number') || searchParams.get('block_height');

    if (!blockHeight) {
      return NextResponse.json({
        error: 'block_number or block_height parameter required'
      }, { status: 400 });
    }

    const execBlockNum = parseInt(blockHeight);

    // Step 1: Get slot from Beaconcha.in API
    const slotInfo = await getSlotFromBlockHeight(execBlockNum);

    if (!slotInfo) {
      return NextResponse.json({
        block_height: execBlockNum,
        slot: null,
        relay_name: null,
        origin: null,
        beat_bloxroute: null,
        time_difference_ms: null,
        in_database: false,
        message: `Could not fetch slot info for block height ${execBlockNum}`
      });
    }

    // Step 2: Look up by slot (block_number) in our database
    const block = await prisma.block.findFirst({
      where: { block_number: slotInfo.slot },
      include: {
        relay_details: {
          orderBy: { arrival_order: 'asc' },
          take: 1  // Get the fastest relay
        }
      }
    });

    // Get fastest relay from our data
    const fastestRelay = block?.relay_details[0];

    // Build response
    const response: any = {
      block_height: execBlockNum,
      slot: slotInfo.slot,
      epoch: slotInfo.epoch,
      block_hash: slotInfo.blockHash,
      // Relay info - prefer our data, fallback to beaconcha.in
      relay_name: fastestRelay?.relay_name || slotInfo.relayTag || null,
      // BloXroute comparison (only from our database)
      origin: block?.origin || null,
      beat_bloxroute: block?.is_win_bloxroute === false,  // false means relay won
      time_difference_ms: block?.time_difference_ms || null,
      bloxroute_comparison: (block && block.is_win_bloxroute !== null) ? {
        we_won: block.is_win_bloxroute === false,
        bloxroute_won: block.is_win_bloxroute === true,
        time_diff_ms: block.time_difference_ms
      } : null,
      in_database: !!block,
      // Additional info from beaconcha.in
      beaconchain_relay: slotInfo.relayTag || null
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Error enriching trade data:', error);
    return NextResponse.json({
      error: 'Failed to fetch block data'
    }, { status: 500 });
  }
}
