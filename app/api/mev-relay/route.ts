import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import type { ApiResponse } from '@/lib/types/api';

// List of MEV relays to check
const MEV_RELAYS = [
  { name: 'Flashbots', url: 'https://boost-relay.flashbots.net' },
  { name: 'bloXroute Max Profit', url: 'https://bloxroute.max-profit.blxrbdn.com' },
  { name: 'bloXroute Regulated', url: 'https://bloxroute.regulated.blxrbdn.com' },
  { name: 'Ultra Sound', url: 'https://relay.ultrasound.money' },
  { name: 'Agnostic Gnosis', url: 'https://agnostic-relay.net' },
  { name: 'Aestus', url: 'https://mainnet.aestus.live' },
  { name: 'Titan', url: 'https://titanrelay.xyz' },
];

interface MevRelayResponse {
  slot: string;
  parent_hash: string;
  block_hash: string;
  builder_pubkey: string;
  proposer_pubkey: string;
  proposer_fee_recipient: string;
  gas_limit: string;
  gas_used: string;
  value: string;
  num_tx: string;
  block_number: string;
}

// Fetch MEV relay data for a specific slot
async function fetchMevRelayData(slot: number): Promise<{
  relay: string;
  builder_pubkey: string;
  value: string;
  block_hash: string;
} | null> {
  for (const relay of MEV_RELAYS) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      const response = await fetch(
        `${relay.url}/relay/v1/data/bidtraces/proposer_payload_delivered?slot=${slot}`,
        {
          signal: controller.signal,
          headers: { 'Accept': 'application/json' },
        }
      );

      clearTimeout(timeoutId);

      if (response.ok) {
        const data: MevRelayResponse[] = await response.json();
        if (data && data.length > 0) {
          return {
            relay: relay.name,
            builder_pubkey: data[0].builder_pubkey,
            value: data[0].value,
            block_hash: data[0].block_hash,
          };
        }
      }
    } catch (error) {
      // Continue to next relay if this one fails
      continue;
    }
  }
  return null;
}

// GET /api/mev-relay?slot=12345 - Get MEV relay data for a specific slot
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const slot = searchParams.get('slot');

    if (!slot) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: 'Missing slot parameter',
      }, { status: 400 });
    }

    const slotNumber = parseInt(slot, 10);
    if (isNaN(slotNumber)) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: 'Invalid slot number',
      }, { status: 400 });
    }

    // Check if we already have MEV relay data for this slot
    const existingBlock = await prisma.block.findUnique({
      where: { block_number: slotNumber },
      select: { mev_relay: true, mev_builder_pubkey: true, mev_block_value: true },
    });

    if (existingBlock?.mev_relay) {
      return NextResponse.json<ApiResponse>({
        success: true,
        data: {
          slot: slotNumber,
          mev_relay: existingBlock.mev_relay,
          builder_pubkey: existingBlock.mev_builder_pubkey,
          value: existingBlock.mev_block_value,
          cached: true,
        },
      });
    }

    // Fetch from MEV relays
    const mevData = await fetchMevRelayData(slotNumber);

    if (!mevData) {
      return NextResponse.json<ApiResponse>({
        success: true,
        data: {
          slot: slotNumber,
          mev_relay: null,
          message: 'No MEV relay data found for this slot',
        },
      });
    }

    // Update the block in database if it exists
    await prisma.block.updateMany({
      where: { block_number: slotNumber },
      data: {
        mev_relay: mevData.relay,
        mev_builder_pubkey: mevData.builder_pubkey,
        mev_block_value: mevData.value,
      },
    });

    return NextResponse.json<ApiResponse>({
      success: true,
      data: {
        slot: slotNumber,
        mev_relay: mevData.relay,
        builder_pubkey: mevData.builder_pubkey,
        value: mevData.value,
        cached: false,
      },
    });
  } catch (error) {
    console.error('Error fetching MEV relay data:', error);
    return NextResponse.json<ApiResponse>({
      success: false,
      error: 'Internal server error',
    }, { status: 500 });
  }
}

// PATCH /api/mev-relay - Backfill MEV relay data for multiple slots
export async function PATCH(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const limitParam = searchParams.get('limit');
    const limit = limitParam ? parseInt(limitParam, 10) : 100;

    // Find blocks without MEV relay data
    const blocksWithoutMev = await prisma.block.findMany({
      where: {
        mev_relay: null,
        bloxroute_timestamp: { not: null }, // Only blocks with bloxroute data
      },
      select: { block_number: true },
      orderBy: { block_number: 'desc' },
      take: limit,
    });

    const results: { slot: number; relay: string | null; success: boolean }[] = [];

    for (const block of blocksWithoutMev) {
      try {
        const mevData = await fetchMevRelayData(block.block_number);

        if (mevData) {
          await prisma.block.update({
            where: { block_number: block.block_number },
            data: {
              mev_relay: mevData.relay,
              mev_builder_pubkey: mevData.builder_pubkey,
              mev_block_value: mevData.value,
            },
          });
          results.push({ slot: block.block_number, relay: mevData.relay, success: true });
        } else {
          results.push({ slot: block.block_number, relay: null, success: true });
        }

        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 100));
      } catch (error) {
        results.push({ slot: block.block_number, relay: null, success: false });
      }
    }

    const successCount = results.filter(r => r.success && r.relay).length;
    const notFoundCount = results.filter(r => r.success && !r.relay).length;
    const errorCount = results.filter(r => !r.success).length;

    return NextResponse.json<ApiResponse>({
      success: true,
      data: {
        processed: results.length,
        found: successCount,
        not_found: notFoundCount,
        errors: errorCount,
        results,
      },
    });
  } catch (error) {
    console.error('Error backfilling MEV relay data:', error);
    return NextResponse.json<ApiResponse>({
      success: false,
      error: 'Internal server error',
    }, { status: 500 });
  }
}
