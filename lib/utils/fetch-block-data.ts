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
export async function getBlockHashFromSlot(slot: number): Promise<SlotInfo | null> {
  try {
    const apiKey = process.env.BEACONCHAIN_API_KEY;
    const beaconchaUrl = `https://beaconcha.in/api/v1/slot/${slot}`;

    const headers: HeadersInit = {};
    if (apiKey) {
      headers['apikey'] = apiKey;
    }

    const response = await fetch(beaconchaUrl, { headers });
    const data = await response.json();
    if (data.status === "OK" && data.data) {
      return {
        slot: data.data.slot,
        epoch: data.data.epoch,
        blockRoot: data.data.blockroot,
        stateRoot: data.data.stateroot,
        proposerIndex: data.data.proposer,
        executionBlockHash: data.data.exec_block_hash,
        executionBlockNumber: data.data.exec_block_number,
        status: data.data.status
      };
    }
    return null;
  } catch (error) {
    console.error('Error fetching slot:', error);
    return null;
  }
}

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
  try {
    // Remove 0x prefix if present
    const hashWithoutPrefix = blockHash.replace('0x', '');
    // wait for 3 seconds
    await new Promise(resolve => setTimeout(resolve, 3000));
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
        return await response.json();
      } else {
        const text = await response.text();
        console.error('Bloxroute returned non-JSON response:', text);
        return null;
      }
    } else {
      console.error(`Bloxroute API returned status: ${response.status}`);
      return null;
    }

  } catch (error) {
    console.error('Error querying Bloxroute:', error);
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
        return await response.json();
      } else {
        const text = await response.text();
        console.error('Bloxroute receipts returned non-JSON response:', text);
        return null;
      }
    } else {
      console.error(`Bloxroute receipts API returned status: ${response.status}`);
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
