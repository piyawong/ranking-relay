/**
 * External Background Service: Trade Processor
 *
 * Processes pending trades independently of the portal.
 * - Finds trades with tx_hash but no calculated onchain values
 * - Fetches onchain data and calculates profit
 * - Sends telegram notifications
 *
 * Run with: npx tsx scripts/trade-processor.ts
 * Or via pm2: pm2 start ecosystem.config.js --only trade-processor
 */

import { prisma } from '../lib/db/prisma';
import { fetchTransactionData, calculateProfit } from '../lib/utils/onchain-fetcher';

// Configuration
const PROCESS_INTERVAL_MS = 4000; // Process every 4 seconds
const MAX_TRADES_PER_BATCH = 10;
const TRADE_PROFIT_PATTERN = 'Trade Profit/Loss';
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

// Track service state
let isRunning = true;
let processedCount = 0;
let errorCount = 0;
let lastProcessTime: Date | null = null;

/**
 * Send telegram notification
 */
async function sendTelegramNotification(message: string): Promise<void> {
  try {
    const response = await fetch(`${API_URL}/api/notify/telegram`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message,
        timestamp: new Date().toISOString(),
        pattern: TRADE_PROFIT_PATTERN,
      }),
    });

    if (!response.ok) {
      console.warn(`[Telegram] Notification failed: ${response.status}`);
    }
  } catch (error) {
    console.error('[Telegram] Failed to send notification:', error);
  }
}

/**
 * Process a single pending trade
 */
async function processTrade(trade: {
  id: string;
  trade_id: string | null;
  tx_hash: string | null;
  onsite_value_with_fee: unknown;
  step1_usd_value: unknown;
  direction: string | null;
  trade_amount_rlb: unknown;
}): Promise<{ success: boolean; error?: string }> {
  if (!trade.tx_hash) {
    return { success: false, error: 'No tx_hash' };
  }

  // Fetch on-chain data
  const txData = await fetchTransactionData(trade.tx_hash);

  if (!txData.success) {
    return { success: false, error: txData.error };
  }

  // Get the onsite value (prefer onsite_value_with_fee, fall back to step1_usd_value)
  const onsiteValue = trade.onsite_value_with_fee
    ? parseFloat(trade.onsite_value_with_fee as string)
    : trade.step1_usd_value
    ? parseFloat(trade.step1_usd_value as string)
    : null;

  if (onsiteValue === null) {
    return { success: false, error: 'No onsite value found' };
  }

  // Determine direction and select the appropriate onchain value:
  // - buy_onsite_sell_onchain: We sell RLB on-chain, RECEIVE stablecoins/ETH
  // - sell_onsite_buy_onchain: We buy RLB on-chain, SEND stablecoins/ETH
  const direction = trade.direction || 'buy_onsite_sell_onchain';

  // Use totalUsdSent/totalUsdReceived which includes stablecoins + WETH + native ETH
  const onchainValue = direction === 'sell_onsite_buy_onchain'
    ? txData.totalUsdSent     // Buying RLB = we spend stablecoins/ETH
    : txData.totalUsdReceived;  // Selling RLB = we receive stablecoins/ETH

  // Validate onchain value - must be non-zero for a valid trade
  // If onchain value is 0, the transaction logs may not have been parsed correctly
  if (onchainValue === 0 || onchainValue < 1) {
    return {
      success: false,
      error: `Invalid onchain value: ${onchainValue}. Transaction may not have any transfers or logs failed to parse. Stable sent: $${txData.totalStableSent.toFixed(2)}, WETH sent: $${txData.wethSentUsd.toFixed(2)}, ETH sent: $${txData.txEthValueUsd.toFixed(2)}`
    };
  }

  // Calculate profit based on direction
  const { rawProfit, profitWithGas } = calculateProfit(
    direction,
    onsiteValue,
    onchainValue,
    txData.gasUsedUsd
  );

  // Update the trade
  await prisma.trade.update({
    where: { id: trade.id },
    data: {
      onchain_usd_value: onchainValue,
      gas_used_usd: txData.gasUsedUsd,
      raw_profit_usd: rawProfit,
      profit_with_gas_usd: profitWithGas,
    },
  });

  // Log success
  const tradeId = trade.trade_id || trade.id;
  console.log(`[Processed] Trade ${tradeId}: profit = $${profitWithGas.toFixed(2)}`);

  // Send telegram notification
  const profitEmoji = profitWithGas >= 0 ? '💰' : '📉';
  const profitLabel = profitWithGas >= 0 ? 'PROFIT' : 'LOSS';
  const tradeAmount = trade.trade_amount_rlb
    ? parseFloat(trade.trade_amount_rlb as string).toLocaleString()
    : '?';

  const notificationMsg = `${profitEmoji} <b>Trade ${profitLabel}</b>

Amount: ${tradeAmount} RLB
Direction: ${direction === 'buy_onsite_sell_onchain' ? 'Buy Onsite → Sell Onchain' : 'Sell Onsite → Buy Onchain'}

Onsite: $${onsiteValue.toFixed(2)}
Onchain: $${onchainValue.toFixed(2)}
Gas: $${txData.gasUsedUsd.toFixed(4)}

<b>Raw Profit: $${rawProfit.toFixed(2)}</b>
<b>Final Profit: $${profitWithGas.toFixed(2)}</b>`;

  await sendTelegramNotification(notificationMsg);

  return { success: true };
}

/**
 * Main processing loop - find and process pending trades
 */
async function processPendingTrades(): Promise<void> {
  try {
    // Find trades that need processing:
    // - Has tx_hash
    // - Has onsite value
    // - Missing onchain_usd_value OR profit_with_gas_usd
    const pendingTrades = await prisma.trade.findMany({
      where: {
        tx_hash: { not: null },
        OR: [
          { onsite_value_with_fee: { not: null } },
          { step1_usd_value: { not: null } },
        ],
        AND: [
          {
            OR: [
              { onchain_usd_value: null },
              { profit_with_gas_usd: null },
            ],
          },
        ],
      },
      orderBy: { timestamp: 'desc' },
      take: MAX_TRADES_PER_BATCH,
      select: {
        id: true,
        trade_id: true,
        tx_hash: true,
        onsite_value_with_fee: true,
        step1_usd_value: true,
        direction: true,
        trade_amount_rlb: true,
      },
    });

    lastProcessTime = new Date();

    if (pendingTrades.length === 0) {
      return; // Nothing to process
    }

    console.log(`[Processing] Found ${pendingTrades.length} pending trades`);

    for (const trade of pendingTrades) {
      if (!isRunning) break; // Check if service is stopping

      const result = await processTrade(trade);

      if (result.success) {
        processedCount++;
      } else {
        errorCount++;
        console.error(`[Error] Trade ${trade.trade_id || trade.id}: ${result.error}`);
      }
    }
  } catch (error) {
    console.error('[Error] Failed to process pending trades:', error);
    errorCount++;
  }
}

/**
 * Print service status
 */
function printStatus(): void {
  const uptime = process.uptime();
  const hours = Math.floor(uptime / 3600);
  const minutes = Math.floor((uptime % 3600) / 60);
  const seconds = Math.floor(uptime % 60);

  console.log(`\n[Status] Uptime: ${hours}h ${minutes}m ${seconds}s | Processed: ${processedCount} | Errors: ${errorCount}`);
}

/**
 * Graceful shutdown handler
 */
async function shutdown(signal: string): Promise<void> {
  console.log(`\n[Shutdown] Received ${signal}, stopping service...`);
  isRunning = false;

  // Wait a moment for any in-progress processing to complete
  await new Promise(resolve => setTimeout(resolve, 1000));

  await prisma.$disconnect();
  console.log('[Shutdown] Database disconnected');
  console.log(`[Shutdown] Final stats - Processed: ${processedCount}, Errors: ${errorCount}`);
  process.exit(0);
}

/**
 * Main entry point
 */
async function main(): Promise<void> {
  console.log('==============================================');
  console.log('   Trade Processor Service');
  console.log('==============================================');
  console.log(`[Config] Process interval: ${PROCESS_INTERVAL_MS}ms`);
  console.log(`[Config] Max trades per batch: ${MAX_TRADES_PER_BATCH}`);
  console.log(`[Config] API URL: ${API_URL}`);
  console.log('==============================================\n');

  // Register shutdown handlers
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));

  // Start processing loop
  console.log('[Service] Starting trade processor...\n');

  // Run immediately on start
  await processPendingTrades();

  // Set up interval
  const processInterval = setInterval(async () => {
    if (isRunning) {
      await processPendingTrades();
    }
  }, PROCESS_INTERVAL_MS);

  // Print status every 60 seconds
  const statusInterval = setInterval(() => {
    if (isRunning) {
      printStatus();
    }
  }, 60000);

  // Keep process alive
  process.on('beforeExit', () => {
    clearInterval(processInterval);
    clearInterval(statusInterval);
  });
}

// Start the service
main().catch((error) => {
  console.error('[Fatal] Service failed to start:', error);
  process.exit(1);
});
