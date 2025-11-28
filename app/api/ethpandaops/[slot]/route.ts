import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';

// Ethereum mainnet genesis time
const GENESIS_TIME = 1606824023;
const SLOT_DURATION = 12;

// Beaconcha.in API key
const BEACONCHAIN_API_KEY = process.env.BEACONCHAIN_API_KEY || '';

// Cache duration for validator entities (30 days)
const CACHE_DURATION_MS = 30 * 24 * 60 * 60 * 1000;

// Calculate slot_start_date_time from slot number
function calculateSlotStartDateTime(slot: number): number {
  return GENESIS_TIME + (slot * SLOT_DURATION);
}

// Decode hex string to ASCII
function hexToAscii(hex: string): string {
  try {
    const cleanHex = hex.startsWith('0x') ? hex.slice(2) : hex;
    let str = '';
    for (let i = 0; i < cleanHex.length; i += 2) {
      const charCode = parseInt(cleanHex.substr(i, 2), 16);
      if (charCode >= 32 && charCode <= 126) { // printable ASCII
        str += String.fromCharCode(charCode);
      }
    }
    return str.trim();
  } catch {
    return '';
  }
}

interface BeaconChainData {
  builder: string;
  feeRecipient: string;
  txCount: number;
  gasUsed: number;
  gasLimit: number;
  proposer: number;
  graffiti: string;
  execBlockNumber: number;
  execBlockHash: string;
}

interface ProposerEntity {
  validatorIndex: number;
  entityName: string | null;
  poolName: string | null;
}

// Fetch proposer entity from cache or beaconcha.in
async function getProposerEntity(validatorIndex: number): Promise<ProposerEntity | null> {
  if (!validatorIndex || validatorIndex <= 0) {
    return null;
  }

  try {
    // Check cache first
    const cached = await prisma.validatorEntity.findUnique({
      where: { validator_index: validatorIndex }
    });

    // If cached and not expired, return cached value
    if (cached) {
      const cacheAge = Date.now() - cached.last_fetched.getTime();
      if (cacheAge < CACHE_DURATION_MS) {
        return {
          validatorIndex: cached.validator_index,
          entityName: cached.entity_name,
          poolName: cached.pool_name
        };
      }
    }

    // Fetch from beaconcha.in API
    if (!BEACONCHAIN_API_KEY) {
      console.warn('No BEACONCHAIN_API_KEY configured');
      return null;
    }

    const beaconchainUrl = `https://beaconcha.in/api/v1/validator/${validatorIndex}`;
    const response = await fetch(beaconchainUrl, {
      headers: {
        'apikey': BEACONCHAIN_API_KEY,
        'Accept': 'application/json'
      }
    });

    if (!response.ok) {
      if (response.status === 429) {
        console.warn('Beaconcha.in rate limit hit');
      } else {
        console.error(`Beaconcha.in API error: ${response.status}`);
      }
      // Return cached value even if expired, or null
      if (cached) {
        return {
          validatorIndex: cached.validator_index,
          entityName: cached.entity_name,
          poolName: cached.pool_name
        };
      }
      return null;
    }

    const data = await response.json();
    const validatorData = data.data;

    // Extract entity name from the response
    // beaconcha.in returns pool name in the 'name' field if validator is part of a known pool
    const entityName = validatorData?.name || null;
    const poolName = validatorData?.pool || null;

    // Handle exit_epoch - beaconcha.in uses very large values for active validators
    // which can overflow a 64-bit signed integer, so we cap it or set to null
    const MAX_SAFE_EPOCH = 2147483647; // Max 32-bit signed integer
    const exitEpoch = validatorData?.exitepoch && validatorData.exitepoch < MAX_SAFE_EPOCH
      ? validatorData.exitepoch
      : null;
    const activationEpoch = validatorData?.activationepoch && validatorData.activationepoch < MAX_SAFE_EPOCH
      ? validatorData.activationepoch
      : null;

    // Upsert to cache
    await prisma.validatorEntity.upsert({
      where: { validator_index: validatorIndex },
      create: {
        validator_index: validatorIndex,
        entity_name: entityName,
        pool_name: poolName,
        withdrawal_address: validatorData?.withdrawalcredentials || null,
        activation_epoch: activationEpoch,
        exit_epoch: exitEpoch,
        last_fetched: new Date()
      },
      update: {
        entity_name: entityName,
        pool_name: poolName,
        withdrawal_address: validatorData?.withdrawalcredentials || null,
        activation_epoch: activationEpoch,
        exit_epoch: exitEpoch,
        last_fetched: new Date()
      }
    });

    return {
      validatorIndex,
      entityName,
      poolName
    };
  } catch (error) {
    console.error('Error fetching proposer entity:', error);
    return null;
  }
}

// Fetch proposer index from beacon node
async function getProposerIndex(slot: number): Promise<number | null> {
  const beaconNodeUrl = process.env.BEACON_NODE_URL || 'http://host.docker.internal:5052';

  try {
    // Try to get block header to get proposer index
    const response = await fetch(`${beaconNodeUrl}/eth/v1/beacon/headers/${slot}`, {
      headers: { 'Accept': 'application/json' }
    });

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    const proposerIndex = parseInt(data?.data?.header?.message?.proposer_index, 10);
    return isNaN(proposerIndex) ? null : proposerIndex;
  } catch (error) {
    console.error('Error fetching proposer index from beacon node:', error);
    return null;
  }
}

interface EthPandaOpsNode {
  block_root: string;
  classification: string;
  epoch: number;
  meta_client_geo_city: string | null;
  meta_client_geo_country: string | null;
  meta_client_geo_country_code: string | null;
  meta_client_geo_continent_code: string | null;
  meta_client_implementation: string;
  meta_client_name: string;
  meta_client_version: string;
  meta_consensus_implementation: string;
  meta_consensus_version: string;
  node_id: string;
  seen_slot_start_diff: number;
  slot: number;
  slot_start_date_time: number;
  source: string;
  username: string;
}

interface EthPandaOpsResponse {
  fct_block_first_seen_by_node: EthPandaOpsNode[];
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slot: string }> }
) {
  try {
    const { slot: slotParam } = await params;
    const slot = parseInt(slotParam);

    if (isNaN(slot)) {
      return NextResponse.json(
        { success: false, error: 'Invalid slot number' },
        { status: 400 }
      );
    }

    const slotStartDateTime = calculateSlotStartDateTime(slot);

    // Fetch from ethpandaops API
    const ethpandaopsUrl = `https://lab.ethpandaops.io/api/v1/mainnet/fct_block_first_seen_by_node?slot_start_date_time_eq=${slotStartDateTime}&page_size=10000`;

    // Also try to get block info from local reth node using timestamp
    const rethUrl = process.env.ETH_RPC_URL || 'http://host.docker.internal:8545';

    const ethpandaopsResponse = await fetch(ethpandaopsUrl, {
      headers: { 'Accept': 'application/json' },
      next: { revalidate: 300 }
    });

    if (!ethpandaopsResponse.ok) {
      return NextResponse.json(
        { success: false, error: `EthPandaOps API error: ${ethpandaopsResponse.status}` },
        { status: ethpandaopsResponse.status }
      );
    }

    const data: EthPandaOpsResponse = await ethpandaopsResponse.json();
    const nodes = data.fct_block_first_seen_by_node || [];

    // Try to get block info from local reth using the slot timestamp
    let blockInfo: BeaconChainData | null = null;
    try {
      // Find block by timestamp - slot time in hex
      const timestampHex = '0x' + slotStartDateTime.toString(16);

      // First, get the block number at this timestamp
      const blockByTimestampResponse = await fetch(rethUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'eth_getBlockByNumber',
          params: ['latest', false],
          id: 1
        })
      });

      if (blockByTimestampResponse.ok) {
        const latestBlock = await blockByTimestampResponse.json();
        if (latestBlock.result) {
          // Calculate approximate block number from slot timestamp
          // Average block time is ~12 seconds on Ethereum
          const latestBlockNumber = parseInt(latestBlock.result.number, 16);
          const latestTimestamp = parseInt(latestBlock.result.timestamp, 16);
          const timeDiff = latestTimestamp - slotStartDateTime;
          const blockDiff = Math.floor(timeDiff / 12);
          const targetBlockNumber = latestBlockNumber - blockDiff;

          // Get the target block
          const blockResponse = await fetch(rethUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              jsonrpc: '2.0',
              method: 'eth_getBlockByNumber',
              params: ['0x' + targetBlockNumber.toString(16), false],
              id: 2
            })
          });

          if (blockResponse.ok) {
            const blockData = await blockResponse.json();
            if (blockData.result) {
              const block = blockData.result;
              blockInfo = {
                builder: hexToAscii(block.extraData || ''),
                feeRecipient: block.miner || '',
                txCount: block.transactions?.length || 0,
                gasUsed: parseInt(block.gasUsed, 16),
                gasLimit: parseInt(block.gasLimit, 16),
                proposer: 0, // Not available from execution layer
                graffiti: '', // Not available from execution layer
                execBlockNumber: parseInt(block.number, 16),
                execBlockHash: block.hash || '',
              };
            }
          }
        }
      }
    } catch (err) {
      console.error('Error fetching block from reth:', err);
      // Continue without block info
    }

    // Fetch proposer entity (from beacon node + beaconcha.in with caching)
    let proposerEntity: ProposerEntity | null = null;
    try {
      const proposerIndex = await getProposerIndex(slot);
      if (proposerIndex !== null) {
        // Update blockInfo with proposer index
        if (blockInfo) {
          blockInfo.proposer = proposerIndex;
        }
        // Fetch entity name (with caching)
        proposerEntity = await getProposerEntity(proposerIndex);
      }
    } catch (err) {
      console.error('Error fetching proposer entity:', err);
      // Continue without proposer entity
    }

    // Sort by seen_slot_start_diff (fastest first)
    const sortedNodes = nodes.sort((a, b) => a.seen_slot_start_diff - b.seen_slot_start_diff);

    // Get unique block roots (should be 1 for a valid slot)
    const blockRoots = Array.from(new Set(nodes.map(n => n.block_root)));

    // Calculate statistics
    const seenTimes = nodes.map(n => n.seen_slot_start_diff);
    const minTime = seenTimes.length > 0 ? Math.min(...seenTimes) : 0;
    const maxTime = seenTimes.length > 0 ? Math.max(...seenTimes) : 0;
    const avgTime = seenTimes.length > 0
      ? seenTimes.reduce((a, b) => a + b, 0) / seenTimes.length
      : 0;
    const medianTime = seenTimes.length > 0
      ? seenTimes.sort((a, b) => a - b)[Math.floor(seenTimes.length / 2)]
      : 0;

    // Group by country
    const byCountry: Record<string, { count: number; avgTime: number; minTime: number }> = {};
    nodes.forEach(node => {
      const country = node.meta_client_geo_country || 'Unknown';
      if (!byCountry[country]) {
        byCountry[country] = { count: 0, avgTime: 0, minTime: Infinity };
      }
      byCountry[country].count++;
      byCountry[country].avgTime += node.seen_slot_start_diff;
      byCountry[country].minTime = Math.min(byCountry[country].minTime, node.seen_slot_start_diff);
    });

    // Calculate averages for countries
    Object.keys(byCountry).forEach(country => {
      byCountry[country].avgTime = byCountry[country].avgTime / byCountry[country].count;
    });

    // Group by consensus implementation
    const byConsensus: Record<string, { count: number; avgTime: number }> = {};
    nodes.forEach(node => {
      const impl = node.meta_consensus_implementation || 'Unknown';
      if (!byConsensus[impl]) {
        byConsensus[impl] = { count: 0, avgTime: 0 };
      }
      byConsensus[impl].count++;
      byConsensus[impl].avgTime += node.seen_slot_start_diff;
    });

    Object.keys(byConsensus).forEach(impl => {
      byConsensus[impl].avgTime = byConsensus[impl].avgTime / byConsensus[impl].count;
    });

    return NextResponse.json({
      success: true,
      data: {
        slot,
        slotStartDateTime,
        blockRoots,
        blockInfo,
        proposerEntity,
        totalNodes: nodes.length,
        statistics: {
          minTime,
          maxTime,
          avgTime: Math.round(avgTime),
          medianTime,
        },
        byCountry: Object.entries(byCountry)
          .map(([country, stats]) => ({
            country,
            ...stats,
            avgTime: Math.round(stats.avgTime),
          }))
          .sort((a, b) => a.minTime - b.minTime),
        byConsensus: Object.entries(byConsensus)
          .map(([implementation, stats]) => ({
            implementation,
            ...stats,
            avgTime: Math.round(stats.avgTime),
          }))
          .sort((a, b) => a.avgTime - b.avgTime),
        nodes: sortedNodes.slice(0, 50).map(node => ({
          nodeId: node.node_id,
          city: node.meta_client_geo_city,
          country: node.meta_client_geo_country,
          countryCode: node.meta_client_geo_country_code,
          continentCode: node.meta_client_geo_continent_code,
          seenSlotStartDiff: node.seen_slot_start_diff,
          consensusImpl: node.meta_consensus_implementation,
          consensusVersion: node.meta_consensus_version,
          clientName: node.meta_client_name,
          source: node.source,
          classification: node.classification,
        })),
      },
    });
  } catch (error) {
    console.error('Error fetching ethpandaops data:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch propagation data' },
      { status: 500 }
    );
  }
}
