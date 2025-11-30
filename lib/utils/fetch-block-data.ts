/**
 * Fetch Ethereum Block Data from Slot Number
 * Combines: Slot -> Hash -> Bloxroute BDN Explorer
 */

export interface SlotInfo {
  slot: number;
  epoch: number;
  blockRoot: string;
  stateRoot: string;
  proposerIndex: number;
  executionBlockHash: string;
  executionBlockNumber: number;
  status: string;
}

export interface BloxrouteData {
  miner: string;
  origin: string;
  propagationTime: number;
  timestamp: Date;
  transactionCount: number;
  originalSize: number;
  compressionRate: number;
  forkChains: string;
  previousBlockHash: string;
  nextBlockHash: string;
}

export interface BloxrouteReceipt {
  timestamp: number;
  nodeId: string;
  externalIp: string;
  logicalName: string;
  locationLat: number;
  locationLng: number;
}

export interface BloxrouteReceiveData {
  blockReceipts: BloxrouteReceipt[];
}

export interface BlockData {
  slotInfo: SlotInfo | null;
  bloxrouteData: BloxrouteData | null;
}

/**
 * Get block information from slot number using Beaconcha.in API
 *
 * Args:
 *   slot: Slot number to query
 *
 * Returns:
 *   SlotInfo object or null if not found
 */
// Simple in-memory cache for slot data
const slotCache = new Map<number, { data: SlotInfo | null; timestamp: number }>();
// Cache for execution block -> slot mapping (permanent since this never changes)
const executionBlockToSlotCache = new Map<number, { slot: number | null; timestamp: number }>();
const CACHE_TTL = 60 * 1000; // 1 minute cache for slot data
const EXEC_BLOCK_CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours for exec block -> slot (permanent mapping)

// Ethereum merge constants - used for approximate slot estimation
const MERGE_BLOCK = 15537394;
const MERGE_SLOT = 4700013;

/**
 * Get block information from slot using local beacon node
 * Falls back to Beaconcha.in if local node fails
 */
async function getBlockFromLocalNode(slot: number): Promise<SlotInfo | null> {
  try {
    // Use local beacon node API (Grandine on port 5052)
    const localNodeUrl = process.env.BEACON_NODE_URL || 'http://localhost:5052';
    const url = `${localNodeUrl}/eth/v2/beacon/blocks/${slot}`;

    const response = await fetch(url, {
      headers: { 'Accept': 'application/json' }
    });

    if (!response.ok) {
      console.log(`Local node returned ${response.status} for slot ${slot}`);
      return null;
    }

    const result = await response.json();
    if (result.data) {
      const block = result.data;
      const message = block.message;

      // Extract execution payload information
      const executionPayload = message.body?.execution_payload;

      if (executionPayload) {
        return {
          slot: parseInt(message.slot),
          epoch: Math.floor(parseInt(message.slot) / 32),
          blockRoot: block.signature || '',
          stateRoot: message.state_root,
          proposerIndex: parseInt(message.proposer_index),
          executionBlockHash: executionPayload.block_hash,
          executionBlockNumber: parseInt(executionPayload.block_number),
          status: 'proposed'
        };
      }
    }

    return null;
  } catch (error) {
    console.log('Failed to fetch from local node:', error);
    return null;
  }
}

// REMOVED: getBlockHashFromEthRPC function - no longer using ETH RPC fallback

export async function getBlockHashFromSlot(slot: number): Promise<SlotInfo | null> {
  try {
    // Check cache first
    const cached = slotCache.get(slot);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      console.log(`Using cached slot data for slot ${slot}`);
      return cached.data;
    }

    // Only use local beacon node - no fallback
    const localResult = await getBlockFromLocalNode(slot);
    if (localResult) {
      console.log(`Got slot ${slot} data from local node`);
      // Cache the result
      slotCache.set(slot, { data: localResult, timestamp: Date.now() });
      return localResult;
    }

    // No fallback - if beacon node fails, return null
    console.log(`Local beacon node failed for slot ${slot}, no fallback configured`);
    // Cache null result to prevent immediate retries
    slotCache.set(slot, { data: null, timestamp: Date.now() });
    return null;
  } catch (error) {
    console.error('Error fetching slot:', error);
    // Cache null result for errors
    slotCache.set(slot, { data: null, timestamp: Date.now() });
    return null;
  }
}

/**
 * Get the beacon slot number for a given execution block number.
 * Uses beaconcha.in API for accurate lookup.
 *
 * Args:
 *   executionBlock: Ethereum execution layer block number
 *
 * Returns:
 *   Slot number or null if not found
 */
export async function getSlotForExecutionBlock(executionBlock: number): Promise<number | null> {
  // Check cache first (long TTL since this mapping never changes)
  const cached = executionBlockToSlotCache.get(executionBlock);
  if (cached && Date.now() - cached.timestamp < EXEC_BLOCK_CACHE_TTL) {
    return cached.slot;
  }

  // Can't convert pre-merge blocks
  if (executionBlock < MERGE_BLOCK) {
    executionBlockToSlotCache.set(executionBlock, { slot: null, timestamp: Date.now() });
    return null;
  }

  try {
    // Use beaconcha.in API to get slot from execution block
    const apiKey = process.env.BEACONCHAIN_API_KEY || 'RmZjQjd2dk1MOWxCanJPaE1zdU1KU0pHd1hFUQ';
    const url = `https://beaconcha.in/api/v1/execution/block/${executionBlock}?apikey=${apiKey}`;
    console.log(`Fetching slot for execution block ${executionBlock} from beaconcha.in...`);

    const response = await fetch(url, {
      headers: {
        'Accept': 'application/json'
      }
    });

    if (!response.ok) {
      console.error(`beaconcha.in API error for block ${executionBlock}: ${response.status}`);
      executionBlockToSlotCache.set(executionBlock, { slot: null, timestamp: Date.now() });
      return null;
    }

    const data = await response.json();

    // beaconcha.in returns { status: "OK", data: [{ posConsensus: { slot: ... } }] }
    if (data.status === 'OK' && data.data && data.data.length > 0) {
      const slot = data.data[0].posConsensus?.slot;
      if (slot !== undefined && slot !== null) {
        console.log(`Found slot ${slot} for execution block ${executionBlock} via beaconcha.in`);
        executionBlockToSlotCache.set(executionBlock, { slot, timestamp: Date.now() });
        return slot;
      }
    }

    console.log(`No slot found for execution block ${executionBlock} in beaconcha.in response`);
    executionBlockToSlotCache.set(executionBlock, { slot: null, timestamp: Date.now() });
    return null;
  } catch (error) {
    console.error(`Error fetching slot for execution block ${executionBlock}:`, error);
    executionBlockToSlotCache.set(executionBlock, { slot: null, timestamp: Date.now() });
    return null;
  }
}

/**
 * Get approximate slot for execution block (fast, but may be off due to missed slots)
 * Use getSlotForExecutionBlock for accurate results.
 */
export function estimateSlotForExecutionBlock(executionBlock: number): number {
  if (executionBlock < MERGE_BLOCK) return 0;
  return MERGE_SLOT + (executionBlock - MERGE_BLOCK);
}

// Cache for BloxRoute data
const bloxrouteCache = new Map<string, { data: BloxrouteData | null; timestamp: number }>();

/**
 * Query Bloxroute BDN Explorer for block data
 *
 * Args:
 *   blockHash: Ethereum block hash (with or without 0x prefix)
 *
 * Returns:
 *   BloxrouteData object or null if not found
 */
export async function queryBloxroute(blockHash: string): Promise<BloxrouteData | null> {
  // Remove 0x prefix if present
  const hashWithoutPrefix = blockHash.replace('0x', '');

  try {
    // Check cache first
    const cached = bloxrouteCache.get(hashWithoutPrefix);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      console.log(`Using cached BloxRoute data for hash ${hashWithoutPrefix}`);
      return cached.data;
    }

    // Add a smaller delay to avoid hammering the API
    await new Promise(resolve => setTimeout(resolve, 1000));
    const url = `https://kn8z1kqm76.execute-api.us-east-1.amazonaws.com/prod/block/${hashWithoutPrefix}?bxenvironment=blxrbdn.com&network_num=5`;

    const response = await fetch(url, {
      headers: {
        'accept': '*/*',
        'accept-language': 'en-US,en;q=0.9',
        'cache-control': 'no-cache',
        'origin': 'https://bdn-explorer.bloxroute.com',
        'pragma': 'no-cache',
        'referer': 'https://bdn-explorer.bloxroute.com/',
        'sec-ch-ua': '"Chromium";v="142", "Google Chrome";v="142", "Not_A Brand";v="99"',
        'sec-ch-ua-mobile': '?0',
        'sec-ch-ua-platform': '"macOS"',
        'sec-fetch-dest': 'empty',
        'sec-fetch-mode': 'cors',
        'sec-fetch-site': 'cross-site',
        'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36'
      }
    });

    if (response.status === 200) {
      const contentType = response.headers.get("content-type");
      if (contentType && contentType.includes("application/json")) {
        const data = await response.json();

        // Check if the response indicates the block was not found
        if (data.errors && data.errors.message === "Block was not found") {
          console.error(`Bloxroute: Block ${hashWithoutPrefix} not found in BDN network`);
          console.error(`Bloxroute response: ${JSON.stringify(data.errors)}`);
          // Cache null result
          bloxrouteCache.set(hashWithoutPrefix, { data: null, timestamp: Date.now() });
          return null;
        }

        // Cache successful result
        bloxrouteCache.set(hashWithoutPrefix, { data, timestamp: Date.now() });
        return data;
      } else {
        const text = await response.text();
        console.error('Bloxroute returned non-JSON response:', text);
        // Cache null result
        bloxrouteCache.set(hashWithoutPrefix, { data: null, timestamp: Date.now() });
        return null;
      }
    } else if (response.status === 429) {
      const body = await response.text();
      console.error(`Bloxroute rate limited for hash ${hashWithoutPrefix}: ${response.status}`);
      console.error(`Response body: ${body}`);
      // Cache null result to prevent immediate retries
      bloxrouteCache.set(hashWithoutPrefix, { data: null, timestamp: Date.now() });
      return null;
    } else {
      const body = await response.text();
      console.error(`Bloxroute API error for hash ${hashWithoutPrefix}: ${response.status} ${response.statusText}`);
      console.error(`Response body: ${body}`);
      // Cache null result
      bloxrouteCache.set(hashWithoutPrefix, { data: null, timestamp: Date.now() });
      return null;
    }

  } catch (error) {
    console.error('Error querying Bloxroute:', error);
    // Cache null result for errors
    bloxrouteCache.set(hashWithoutPrefix, { data: null, timestamp: Date.now() });
    return null;
  }
}

/**
 * Query Bloxroute BDN Explorer for block receipts (node propagation data)
 *
 * Args:
 *   blockHash: Ethereum block hash (with or without 0x prefix)
 *
 * Returns:
 *   BloxrouteReceiveData object containing blockReceipts array, or null if not found
 */
export async function queryBloxrouteReceive(blockHash: string): Promise<BloxrouteReceiveData | null> {
  try {
    // Remove 0x prefix if present
    const hashWithoutPrefix = blockHash.replace('0x', '');
    // wait for 3 seconds
    await new Promise(resolve => setTimeout(resolve, 3000));
    const url = `https://kn8z1kqm76.execute-api.us-east-1.amazonaws.com/prod/receipts/${hashWithoutPrefix}?bxenvironment=blxrbdn.com&network=5`;

    const response = await fetch(url, {
      headers: {
        'accept': '*/*',
        'accept-language': 'en-US,en;q=0.9',
        'cache-control': 'no-cache',
        'origin': 'https://bdn-explorer.bloxroute.com',
        'pragma': 'no-cache',
        'referer': 'https://bdn-explorer.bloxroute.com/',
        'sec-ch-ua': '"Chromium";v="142", "Google Chrome";v="142", "Not_A Brand";v="99"',
        'sec-ch-ua-mobile': '?0',
        'sec-ch-ua-platform': '"macOS"',
        'sec-fetch-dest': 'empty',
        'sec-fetch-mode': 'cors',
        'sec-fetch-site': 'cross-site',
        'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36'
      }
    });

    if (response.status === 200) {
      const contentType = response.headers.get("content-type");
      if (contentType && contentType.includes("application/json")) {
        const data = await response.json();

        // Check if the response indicates an error
        if (data.errors) {
          console.error(`Bloxroute receipts error for hash ${hashWithoutPrefix}: ${JSON.stringify(data.errors)}`);
          return null;
        }

        return data;
      } else {
        const text = await response.text();
        console.error('Bloxroute receipts returned non-JSON response:', text);
        return null;
      }
    } else if (response.status === 429) {
      const body = await response.text();
      console.error(`Bloxroute receipts rate limited for hash ${hashWithoutPrefix}: ${response.status}`);
      console.error(`Response body: ${body}`);
      return null;
    } else {
      const body = await response.text();
      console.error(`Bloxroute receipts API error for hash ${hashWithoutPrefix}: ${response.status} ${response.statusText}`);
      console.error(`Response body: ${body}`);
      return null;
    }

  } catch (error) {
    console.error('Error querying Bloxroute receipts:', error);
    return null;
  }
}

/**
 * Extract Germany timestamp from bloXroute receipts
 *
 * Args:
 *   receipts: Array of bloXroute receipts from different geographical nodes
 *
 * Returns:
 *   Date object representing the first Germany node timestamp, or null if no Germany node found
 *
 * Reason: Germany timestamp is used as the canonical bloXroute timestamp for comparisons
 * to ensure consistent geographical reference point
 */
export function getGermanyTimestamp(receipts: BloxrouteReceipt[]): Date | null {
  if (!receipts || receipts.length === 0) {
    return null;
  }

  // Find all Germany nodes
  const germanyReceipts = receipts.filter(
    receipt => receipt.logicalName === 'Germany'
  );

  if (germanyReceipts.length === 0) {
    console.warn('No Germany node found in bloXroute receipts');
    return null;
  }

  // Get the first (earliest) Germany timestamp
  // Reason: Using earliest timestamp for consistency, though all Germany nodes should be very close
  const earliestGermanyReceipt = germanyReceipts.reduce((earliest, current) =>
    current.timestamp < earliest.timestamp ? current : earliest
  );

  // Convert unix timestamp (seconds) to Date object (milliseconds)
  return new Date(earliestGermanyReceipt.timestamp * 1000);
}

/**
 * Fetch complete block data from slot number
 *
 * Args:
 *   slotNumber: Ethereum beacon chain slot number
 *
 * Returns:
 *   Object containing slotInfo and bloxrouteData
 */
export async function fetchBlockData(slotNumber: number): Promise<BlockData> {
  console.log(`Fetching block data for slot ${slotNumber}...`);

  // Step 1: Get block hash from slot
  const slotInfo = await getBlockHashFromSlot(slotNumber);

  if (!slotInfo || !slotInfo.executionBlockHash) {
    console.error('Could not fetch data from this slot number');
    return {
      slotInfo: null,
      bloxrouteData: null
    };
  }

  console.log(`Found Block Hash: ${slotInfo.executionBlockHash}`);

  // Step 2: Query Bloxroute with the hash
  const bloxrouteData = await queryBloxroute(slotInfo.executionBlockHash);

  if (bloxrouteData) {
    console.log('Bloxroute data retrieved successfully');
    return {
      slotInfo,
      bloxrouteData: {
        ...bloxrouteData,
        timestamp: new Date(Number(bloxrouteData.timestamp) * 1000)
      }
    };
  } else {
    console.log('Bloxroute data not available (block might be too old or not in BDN)');
  }

  return {
    slotInfo,
    bloxrouteData: null
  };
}
