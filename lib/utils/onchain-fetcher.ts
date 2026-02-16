import { ethers } from 'ethers';

// USDT and USDC contract addresses on Ethereum mainnet
const USDT_ADDRESS = '0xdAC17F958D2ee523a2206206994597C13D831ec7';
const USDC_ADDRESS = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48';
const WETH_ADDRESS = '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2';

// ERC20 Transfer event signature
const TRANSFER_EVENT_SIGNATURE = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';

// Primary RPC URL (local node or IPC socket)
const PRIMARY_RPC_URL = process.env.ETH_RPC_URL || process.env.QUICKNODE_RPC_URL || 'http://localhost:8545';

// Secondary RPC from env (Infura/Alchemy with API key)
const SECONDARY_RPC_URL = process.env.QUICKNODE_RPC_URL_2 || process.env.ETH_RPC_URL_2 || null;

// Build fallback list dynamically - prefer user's API keys over public RPCs
const FALLBACK_RPC_URLS: string[] = [];

// Add user's secondary RPC first (has API key, more reliable)
if (SECONDARY_RPC_URL) {
  FALLBACK_RPC_URLS.push(SECONDARY_RPC_URL);
}

// Add public RPCs as last resort (free, no API key required)
FALLBACK_RPC_URLS.push(
  'https://eth.llamarpc.com',
  'https://rpc.ankr.com/eth',
  'https://ethereum.publicnode.com',
  'https://1rpc.io/eth',
  'https://eth.drpc.org',
);

// Track the last working RPC to avoid repeated failures
let lastWorkingRpcIndex = -1; // -1 means primary

/**
 * Check if a URL is an IPC socket path
 */
function isIpcPath(url: string): boolean {
  return url.endsWith('.ipc') || url.startsWith('/');
}

/**
 * Create a provider for the given RPC URL (handles HTTP, WebSocket, and IPC)
 */
function createProvider(rpcUrl: string): ethers.JsonRpcProvider | ethers.IpcSocketProvider {
  if (isIpcPath(rpcUrl)) {
    // IPC socket - use IpcSocketProvider
    return new ethers.IpcSocketProvider(rpcUrl);
  }
  // HTTP/HTTPS RPC - use JsonRpcProvider with staticNetwork to avoid auto-detection
  return new ethers.JsonRpcProvider(rpcUrl, undefined, { staticNetwork: true });
}

/**
 * Get a working provider, trying primary first then fallbacks
 */
async function getWorkingProvider(): Promise<{ provider: ethers.JsonRpcProvider | ethers.IpcSocketProvider; rpcUrl: string } | null> {
  // Build list of RPCs to try (primary first, then fallbacks)
  const allRpcs = [PRIMARY_RPC_URL, ...FALLBACK_RPC_URLS];

  // If we have a last working RPC, try it first
  if (lastWorkingRpcIndex >= 0 && lastWorkingRpcIndex < allRpcs.length) {
    const rpcUrl = allRpcs[lastWorkingRpcIndex];
    try {
      const provider = createProvider(rpcUrl);
      // Quick health check - get block number with timeout
      const blockPromise = provider.getBlockNumber();
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('RPC timeout')), 3000)
      );
      await Promise.race([blockPromise, timeoutPromise]);
      return { provider, rpcUrl };
    } catch {
      // Last working RPC failed, reset and try all
      lastWorkingRpcIndex = -1;
    }
  }

  // Try each RPC in order
  for (let i = 0; i < allRpcs.length; i++) {
    const rpcUrl = allRpcs[i];
    try {
      const provider = createProvider(rpcUrl);
      // Quick health check with timeout
      const blockPromise = provider.getBlockNumber();
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('RPC timeout')), 3000)
      );
      await Promise.race([blockPromise, timeoutPromise]);

      // Mark this as working
      lastWorkingRpcIndex = i;
      if (i > 0) {
        console.log(`[RPC] Using fallback: ${rpcUrl}`);
      }
      return { provider, rpcUrl };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      console.warn(`[RPC] Failed to connect to ${rpcUrl}: ${errorMsg}`);
      continue;
    }
  }

  console.error('[RPC] All RPC endpoints failed!');
  return null;
}

interface TransactionResult {
  success: boolean;
  usdtReceived: number;
  usdcReceived: number;
  totalStableReceived: number;
  usdtSent: number;
  usdcSent: number;
  totalStableSent: number;
  // WETH tracking for ETH-based swaps
  wethReceived: number;
  wethSent: number;
  wethReceivedUsd: number;
  wethSentUsd: number;
  // Native ETH value in transaction
  txEthValue: number;
  txEthValueUsd: number;
  // Total USD values (including ETH/WETH)
  totalUsdReceived: number;
  totalUsdSent: number;
  gasUsedEth: number;
  gasUsedUsd: number;
  ethPriceUsd: number;
  error?: string;
}

// Cache ETH price to avoid repeated calls (valid for 1 hour)
let cachedEthPrice: { price: number; timestamp: number } | null = null;
const ETH_PRICE_CACHE_TTL = 3600000; // 1 hour (3600 seconds)

// Provider type that works with both JsonRpcProvider and IpcSocketProvider
type EthProvider = ethers.JsonRpcProvider | ethers.IpcSocketProvider;

/**
 * Get ETH price in USD from Chainlink oracle or public API
 */
async function getEthPriceUsd(provider: EthProvider): Promise<number> {
  // Check cache first
  if (cachedEthPrice && Date.now() - cachedEthPrice.timestamp < ETH_PRICE_CACHE_TTL) {
    return cachedEthPrice.price;
  }

  // Try Chainlink oracle first
  try {
    const chainlinkEthUsd = '0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419';
    const chainlinkAbi = ['function latestRoundData() view returns (uint80, int256, uint256, uint256, uint80)'];
    const chainlinkContract = new ethers.Contract(chainlinkEthUsd, chainlinkAbi, provider);
    const [, answer] = await chainlinkContract.latestRoundData();
    const price = Number(answer) / 1e8; // Chainlink ETH/USD has 8 decimals
    cachedEthPrice = { price, timestamp: Date.now() };
    return price;
  } catch (error) {
    console.warn('[ETH Price] Chainlink failed, trying CoinGecko API...');
  }

  // Fallback to CoinGecko public API
  try {
    const response = await fetch(
      'https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd',
      { signal: AbortSignal.timeout(5000) }
    );
    if (response.ok) {
      const data = await response.json();
      const price = data.ethereum?.usd;
      if (price && typeof price === 'number') {
        cachedEthPrice = { price, timestamp: Date.now() };
        console.log(`[ETH Price] Got from CoinGecko: $${price}`);
        return price;
      }
    }
  } catch (error) {
    console.warn('[ETH Price] CoinGecko API failed');
  }

  // Last resort fallback - use a reasonable current estimate
  // This should rarely be hit
  console.error('[ETH Price] All sources failed, using fallback price');
  return 3000; // Approximate ETH price as of late 2024
}

/**
 * Parse transfer logs to find USDT/USDC/WETH sent and received
 * - For "buy_onsite_sell_onchain": we sell RLB on-chain, RECEIVE stablecoins/ETH
 * - For "sell_onsite_buy_onchain": we buy RLB on-chain, SEND stablecoins/ETH
 */
function parseTransferLogs(
  logs: readonly ethers.Log[],
  userAddress: string
): {
  usdtReceived: number;
  usdcReceived: number;
  usdtSent: number;
  usdcSent: number;
  wethReceived: number;
  wethSent: number;
} {
  let usdtReceived = 0;
  let usdcReceived = 0;
  let usdtSent = 0;
  let usdcSent = 0;
  let wethReceived = 0;
  let wethSent = 0;

  const userAddressLower = userAddress.toLowerCase();

  for (const log of logs) {
    // Check if this is a Transfer event
    if (log.topics[0] !== TRANSFER_EVENT_SIGNATURE) continue;
    if (log.topics.length < 3) continue;

    // Decode the 'from' address from topics[1]
    const fromAddress = '0x' + log.topics[1].slice(26).toLowerCase();
    // Decode the 'to' address from topics[2]
    const toAddress = '0x' + log.topics[2].slice(26).toLowerCase();

    // Check which token this is
    const tokenAddress = log.address.toLowerCase();
    const isUsdt = tokenAddress === USDT_ADDRESS.toLowerCase();
    const isUsdc = tokenAddress === USDC_ADDRESS.toLowerCase();
    const isWeth = tokenAddress === WETH_ADDRESS.toLowerCase();

    if (!isUsdt && !isUsdc && !isWeth) continue;

    // Decode the amount from data
    const amount = BigInt(log.data);

    // USDT/USDC have 6 decimals, WETH has 18 decimals
    const amountDecimal = isWeth
      ? Number(amount) / 1e18
      : Number(amount) / 1e6;

    // Check if we received tokens (to == our address)
    if (toAddress === userAddressLower) {
      if (isUsdt) {
        usdtReceived += amountDecimal;
      } else if (isUsdc) {
        usdcReceived += amountDecimal;
      } else if (isWeth) {
        wethReceived += amountDecimal;
      }
    }

    // Check if we sent tokens (from == our address)
    if (fromAddress === userAddressLower) {
      if (isUsdt) {
        usdtSent += amountDecimal;
      } else if (isUsdc) {
        usdcSent += amountDecimal;
      } else if (isWeth) {
        wethSent += amountDecimal;
      }
    }
  }

  return { usdtReceived, usdcReceived, usdtSent, usdcSent, wethReceived, wethSent };
}

/**
 * Fetch transaction data and calculate values
 * Uses primary RPC with automatic fallback to public RPCs
 */
export async function fetchTransactionData(txHash: string): Promise<TransactionResult> {
  const emptyResult: TransactionResult = {
    success: false,
    usdtReceived: 0,
    usdcReceived: 0,
    totalStableReceived: 0,
    usdtSent: 0,
    usdcSent: 0,
    totalStableSent: 0,
    wethReceived: 0,
    wethSent: 0,
    wethReceivedUsd: 0,
    wethSentUsd: 0,
    txEthValue: 0,
    txEthValueUsd: 0,
    totalUsdReceived: 0,
    totalUsdSent: 0,
    gasUsedEth: 0,
    gasUsedUsd: 0,
    ethPriceUsd: 0,
  };

  try {
    // Get a working provider (primary or fallback)
    const providerResult = await getWorkingProvider();
    if (!providerResult) {
      return {
        ...emptyResult,
        error: 'All RPC endpoints failed - unable to connect to Ethereum network',
      };
    }

    const { provider, rpcUrl } = providerResult;

    // First, check if the transaction exists (even if pending)
    let tx;
    try {
      tx = await provider.getTransaction(txHash);
    } catch (error) {
      // If this RPC fails, try to get a fresh provider
      console.warn(`[RPC] getTransaction failed on ${rpcUrl}, retrying with fresh provider...`);
      lastWorkingRpcIndex = -1; // Reset to try all RPCs
      const retryResult = await getWorkingProvider();
      if (!retryResult) {
        return {
          ...emptyResult,
          error: 'RPC connection failed while fetching transaction',
        };
      }
      tx = await retryResult.provider.getTransaction(txHash);
    }

    if (!tx) {
      return {
        ...emptyResult,
        error: 'Transaction not found - invalid hash or not yet broadcasted',
      };
    }

    // Get transaction receipt (only available after tx is included in a block)
    const receipt = await provider.getTransactionReceipt(txHash);
    if (!receipt) {
      // Transaction exists but no receipt = pending/not yet confirmed
      return {
        ...emptyResult,
        error: 'Transaction pending - not yet included in a block. Please wait for confirmation.',
      };
    }

    const senderAddress = tx.from;

    // Parse transfer logs to find USDT/USDC/WETH sent and received
    const { usdtReceived, usdcReceived, usdtSent, usdcSent, wethReceived, wethSent } = parseTransferLogs(receipt.logs, senderAddress);

    // Calculate gas cost
    const gasUsed = receipt.gasUsed;
    const effectiveGasPrice = receipt.gasPrice || tx.gasPrice || BigInt(0);
    const gasUsedWei = gasUsed * effectiveGasPrice;
    const gasUsedEth = Number(gasUsedWei) / 1e18;

    // Get ETH price
    const ethPriceUsd = await getEthPriceUsd(provider);
    const gasUsedUsd = gasUsedEth * ethPriceUsd;

    // Calculate stablecoin totals
    const totalStableReceived = usdtReceived + usdcReceived;
    const totalStableSent = usdtSent + usdcSent;

    // Calculate WETH USD values
    const wethReceivedUsd = wethReceived * ethPriceUsd;
    const wethSentUsd = wethSent * ethPriceUsd;

    // Get native ETH value sent with the transaction
    const txEthValue = Number(tx.value) / 1e18;
    const txEthValueUsd = txEthValue * ethPriceUsd;

    // Calculate total USD received/sent (stablecoins + WETH)
    // Note: For buy_onchain (sending to buy RLB), we count: stables sent + WETH sent + native ETH sent
    // Note: For sell_onchain (receiving from selling RLB), we count: stables received + WETH received
    const totalUsdReceived = totalStableReceived + wethReceivedUsd;
    const totalUsdSent = totalStableSent + wethSentUsd + txEthValueUsd;

    return {
      success: true,
      usdtReceived,
      usdcReceived,
      totalStableReceived,
      usdtSent,
      usdcSent,
      totalStableSent,
      wethReceived,
      wethSent,
      wethReceivedUsd,
      wethSentUsd,
      txEthValue,
      txEthValueUsd,
      totalUsdReceived,
      totalUsdSent,
      gasUsedEth,
      gasUsedUsd,
      ethPriceUsd,
    };
  } catch (error) {
    console.error('[fetchTransactionData] Error:', error);
    return {
      ...emptyResult,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Calculate profit based on direction
 * - buy_onsite_sell_onchain: profit = onchain_value - onsite_value
 * - sell_onsite_buy_onchain: profit = onsite_value - onchain_value
 */
export function calculateProfit(
  direction: string,
  onsiteValueWithFee: number,
  onchainValue: number,
  gasUsedUsd: number
): { rawProfit: number; profitWithGas: number } {
  let rawProfit: number;

  if (direction === 'buy_onsite_sell_onchain') {
    // We buy on site (cost), sell on chain (revenue)
    rawProfit = onchainValue - onsiteValueWithFee;
  } else {
    // sell_onsite_buy_onchain: We sell on site (revenue), buy on chain (cost)
    rawProfit = onsiteValueWithFee - onchainValue;
  }

  const profitWithGas = rawProfit - gasUsedUsd;

  return { rawProfit, profitWithGas };
}
