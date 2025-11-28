import { ethers } from 'ethers';

// USDT and USDC contract addresses on Ethereum mainnet
const USDT_ADDRESS = '0xdAC17F958D2ee523a2206206994597C13D831ec7';
const USDC_ADDRESS = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48';
const WETH_ADDRESS = '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2';

// ERC20 Transfer event signature
const TRANSFER_EVENT_SIGNATURE = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';

// Local reth node RPC URL
const RPC_URL = process.env.ETH_RPC_URL || 'http://localhost:8545';

interface TransactionResult {
  success: boolean;
  usdtReceived: number;
  usdcReceived: number;
  totalStableReceived: number;
  gasUsedEth: number;
  gasUsedUsd: number;
  ethPriceUsd: number;
  error?: string;
}

/**
 * Get ETH price in USD from the node or a simple source
 * For now, we'll use a reasonable estimate or fetch from the node if available
 */
async function getEthPriceUsd(provider: ethers.JsonRpcProvider): Promise<number> {
  try {
    // Try to get ETH price from Chainlink oracle on mainnet
    const chainlinkEthUsd = '0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419';
    const chainlinkAbi = ['function latestRoundData() view returns (uint80, int256, uint256, uint256, uint80)'];
    const chainlinkContract = new ethers.Contract(chainlinkEthUsd, chainlinkAbi, provider);
    const [, answer] = await chainlinkContract.latestRoundData();
    return Number(answer) / 1e8; // Chainlink ETH/USD has 8 decimals
  } catch (error) {
    console.error('Failed to get ETH price from Chainlink, using fallback:', error);
    // Fallback price - should be updated or fetched from another source
    return 200; // Approximate ETH price
  }
}

/**
 * Parse transfer logs to find USDT/USDC received
 */
function parseTransferLogs(
  logs: readonly ethers.Log[],
  recipientAddress: string
): { usdtReceived: number; usdcReceived: number } {
  let usdtReceived = 0;
  let usdcReceived = 0;

  const recipientLower = recipientAddress.toLowerCase();

  for (const log of logs) {
    // Check if this is a Transfer event
    if (log.topics[0] !== TRANSFER_EVENT_SIGNATURE) continue;
    if (log.topics.length < 3) continue;

    // Decode the 'to' address from topics[2]
    const toAddress = '0x' + log.topics[2].slice(26).toLowerCase();

    // Check if the recipient is our address
    if (toAddress !== recipientLower) continue;

    // Decode the amount from data
    const amount = BigInt(log.data);

    // Check which token this is
    const tokenAddress = log.address.toLowerCase();

    if (tokenAddress === USDT_ADDRESS.toLowerCase()) {
      // USDT has 6 decimals
      usdtReceived += Number(amount) / 1e6;
    } else if (tokenAddress === USDC_ADDRESS.toLowerCase()) {
      // USDC has 6 decimals
      usdcReceived += Number(amount) / 1e6;
    }
  }

  return { usdtReceived, usdcReceived };
}

/**
 * Fetch transaction data and calculate values
 */
export async function fetchTransactionData(txHash: string): Promise<TransactionResult> {
  try {
    const provider = new ethers.JsonRpcProvider(RPC_URL);

    // Get transaction receipt
    const receipt = await provider.getTransactionReceipt(txHash);
    if (!receipt) {
      return {
        success: false,
        usdtReceived: 0,
        usdcReceived: 0,
        totalStableReceived: 0,
        gasUsedEth: 0,
        gasUsedUsd: 0,
        ethPriceUsd: 0,
        error: 'Transaction receipt not found',
      };
    }

    // Get the transaction to find the sender (our address)
    const tx = await provider.getTransaction(txHash);
    if (!tx) {
      return {
        success: false,
        usdtReceived: 0,
        usdcReceived: 0,
        totalStableReceived: 0,
        gasUsedEth: 0,
        gasUsedUsd: 0,
        ethPriceUsd: 0,
        error: 'Transaction not found',
      };
    }

    const senderAddress = tx.from;

    // Parse transfer logs to find USDT/USDC received
    const { usdtReceived, usdcReceived } = parseTransferLogs(receipt.logs, senderAddress);

    // Calculate gas cost
    const gasUsed = receipt.gasUsed;
    const effectiveGasPrice = receipt.gasPrice || tx.gasPrice || BigInt(0);
    const gasUsedWei = gasUsed * effectiveGasPrice;
    const gasUsedEth = Number(gasUsedWei) / 1e18;

    // Get ETH price
    const ethPriceUsd = await getEthPriceUsd(provider);
    const gasUsedUsd = gasUsedEth * ethPriceUsd;

    const totalStableReceived = usdtReceived + usdcReceived;

    return {
      success: true,
      usdtReceived,
      usdcReceived,
      totalStableReceived,
      gasUsedEth,
      gasUsedUsd,
      ethPriceUsd,
    };
  } catch (error) {
    console.error('Error fetching transaction data:', error);
    return {
      success: false,
      usdtReceived: 0,
      usdcReceived: 0,
      totalStableReceived: 0,
      gasUsedEth: 0,
      gasUsedUsd: 0,
      ethPriceUsd: 0,
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
