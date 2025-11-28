import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { fetchTransactionData, calculateProfit } from '@/lib/utils/onchain-fetcher';

// Pattern name for trade profit/loss notifications
const TRADE_PROFIT_PATTERN = 'Trade Profit/Loss';

// Send telegram notification
async function sendTelegramNotification(message: string) {
  try {
    await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'}/api/notify/telegram`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message,
        timestamp: new Date().toISOString(),
        pattern: TRADE_PROFIT_PATTERN, // Check if this pattern is enabled
      }),
    });
  } catch (error) {
    console.error('Failed to send telegram notification:', error);
  }
}

// Process pending trades - find trades with onsite value and tx_hash but no profit
export async function GET(request: NextRequest) {
  try {
    // Find trades that need processing:
    // - Has onsite_value_with_fee OR step1_usd_value (onsite value exists)
    // - Has tx_hash (on-chain transaction exists)
    // - Does NOT have onchain_usd_value OR profit_with_gas_usd (not yet calculated)
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
      take: 10, // Process max 10 at a time to avoid overload
    });

    if (pendingTrades.length === 0) {
      return NextResponse.json({
        message: 'No pending trades to process',
        processed: 0,
      });
    }

    const results = {
      processed: 0,
      failed: 0,
      errors: [] as string[],
      trades: [] as { trade_id: string; status: string; details?: Record<string, unknown> }[],
    };

    for (const trade of pendingTrades) {
      try {
        if (!trade.tx_hash) continue;

        // Fetch on-chain data
        const txData = await fetchTransactionData(trade.tx_hash);

        if (!txData.success) {
          results.failed++;
          results.errors.push(`Trade ${trade.trade_id}: ${txData.error}`);
          results.trades.push({
            trade_id: trade.trade_id || trade.id,
            status: 'failed',
            details: { error: txData.error },
          });
          continue;
        }

        // Get the onsite value (prefer onsite_value_with_fee, fall back to step1_usd_value)
        const onsiteValue = trade.onsite_value_with_fee
          ? parseFloat(trade.onsite_value_with_fee.toString())
          : trade.step1_usd_value
          ? parseFloat(trade.step1_usd_value.toString())
          : null;

        if (onsiteValue === null) {
          results.failed++;
          results.errors.push(`Trade ${trade.trade_id}: No onsite value found`);
          results.trades.push({
            trade_id: trade.trade_id || trade.id,
            status: 'failed',
            details: { error: 'No onsite value' },
          });
          continue;
        }

        // The on-chain value is the total stablecoins received
        const onchainValue = txData.totalStableReceived;

        // Calculate profit based on direction
        const direction = trade.direction || 'buy_onsite_sell_onchain';
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

        results.processed++;
        results.trades.push({
          trade_id: trade.trade_id || trade.id,
          status: 'success',
          details: {
            onsite_value: onsiteValue,
            onchain_value: onchainValue,
            gas_usd: txData.gasUsedUsd,
            raw_profit: rawProfit,
            profit_with_gas: profitWithGas,
            usdt_received: txData.usdtReceived,
            usdc_received: txData.usdcReceived,
            eth_price: txData.ethPriceUsd,
          },
        });

        console.log(`[Process Pending] Processed trade ${trade.trade_id}: profit = $${profitWithGas.toFixed(2)}`);

        // Send telegram notification
        const profitEmoji = profitWithGas >= 0 ? '💰' : '📉';
        const profitLabel = profitWithGas >= 0 ? 'PROFIT' : 'LOSS';
        const tradeAmount = trade.trade_amount_rlb ? parseFloat(trade.trade_amount_rlb.toString()).toLocaleString() : '?';
        const notificationMsg = `${profitEmoji} <b>Trade ${profitLabel}</b>

Amount: ${tradeAmount} RLB
Direction: ${direction === 'buy_onsite_sell_onchain' ? 'Buy Onsite → Sell Onchain' : 'Sell Onsite → Buy Onchain'}

Onsite: $${onsiteValue.toFixed(2)}
Onchain: $${onchainValue.toFixed(2)}
Gas: $${txData.gasUsedUsd.toFixed(4)}

<b>Raw Profit: $${rawProfit.toFixed(2)}</b>
<b>Final Profit: $${profitWithGas.toFixed(2)}</b>`;

        await sendTelegramNotification(notificationMsg);
      } catch (err) {
        results.failed++;
        const errorMsg = err instanceof Error ? err.message : 'Unknown error';
        results.errors.push(`Trade ${trade.trade_id}: ${errorMsg}`);
        results.trades.push({
          trade_id: trade.trade_id || trade.id,
          status: 'error',
          details: { error: errorMsg },
        });
      }
    }

    return NextResponse.json({
      message: `Processed ${results.processed} trades, ${results.failed} failed`,
      ...results,
    });
  } catch (error) {
    console.error('Error processing pending trades:', error);
    return NextResponse.json(
      { error: 'Failed to process pending trades' },
      { status: 500 }
    );
  }
}

// POST can also trigger processing
export async function POST(request: NextRequest) {
  return GET(request);
}
