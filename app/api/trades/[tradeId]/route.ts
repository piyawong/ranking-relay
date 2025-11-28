import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';

// Helper to convert Decimal fields to numbers
function serializeTrade(trade: any) {
  return {
    ...trade,
    initial_reserves_rlb: parseFloat(trade.initial_reserves_rlb.toString()),
    trade_amount_rlb: parseFloat(trade.trade_amount_rlb.toString()),
    step1_usd_value: trade.step1_usd_value ? parseFloat(trade.step1_usd_value.toString()) : null,
    onsite_value_usd: trade.onsite_value_usd ? parseFloat(trade.onsite_value_usd.toString()) : null,
    onsite_value_with_fee: trade.onsite_value_with_fee ? parseFloat(trade.onsite_value_with_fee.toString()) : null,
    onchain_usd_value: trade.onchain_usd_value ? parseFloat(trade.onchain_usd_value.toString()) : null,
    gas_used_usd: trade.gas_used_usd ? parseFloat(trade.gas_used_usd.toString()) : null,
    raw_profit_usd: trade.raw_profit_usd ? parseFloat(trade.raw_profit_usd.toString()) : null,
    profit_with_gas_usd: trade.profit_with_gas_usd ? parseFloat(trade.profit_with_gas_usd.toString()) : null,
    api_call_duration_ms: trade.api_call_duration_ms ? parseFloat(trade.api_call_duration_ms.toString()) : null,
    priority_gwei: trade.priority_gwei ? parseFloat(trade.priority_gwei.toString()) : null,
    opponent_time_gap_ms: trade.opponent_time_gap_ms ? parseFloat(trade.opponent_time_gap_ms.toString()) : null,
  };
}

// Helper to check if a number fits in INT4
const isValidInt4 = (num: number) => num >= -2147483648 && num <= 2147483647;

// GET - Fetch single trade by ID (supports id, trade_id, or trade_number)
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ tradeId: string }> }
) {
  try {
    const { tradeId } = await params;

    // Build OR conditions - only include trade_number if it's a valid INT4
    const parsedNum = parseInt(tradeId);
    const canUseTradeNumber = !isNaN(parsedNum) && isValidInt4(parsedNum);

    // Try to find by different ID types
    const trade = await prisma.trade.findFirst({
      where: {
        OR: [
          { id: tradeId },
          { trade_id: tradeId },
          ...(canUseTradeNumber ? [{ trade_number: parsedNum }] : [])
        ]
      }
    });

    if (!trade) {
      return NextResponse.json({ error: 'Trade not found' }, { status: 404 });
    }

    return NextResponse.json({ trade: serializeTrade(trade) });
  } catch (error) {
    console.error('Error fetching trade:', error);
    return NextResponse.json({ error: 'Failed to fetch trade' }, { status: 500 });
  }
}

// PATCH - Update trade (for editing values like onchain_usd_value, gas, profits)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ tradeId: string }> }
) {
  try {
    const { tradeId } = await params;
    const data = await request.json();

    // Build OR conditions - only include trade_number if it's a valid INT4
    const parsedNum = parseInt(tradeId);
    const canUseTradeNumber = !isNaN(parsedNum) && isValidInt4(parsedNum);

    // Find the trade first
    const existingTrade = await prisma.trade.findFirst({
      where: {
        OR: [
          { id: tradeId },
          { trade_id: tradeId },
          ...(canUseTradeNumber ? [{ trade_number: parsedNum }] : [])
        ]
      }
    });

    if (!existingTrade) {
      return NextResponse.json({ error: 'Trade not found' }, { status: 404 });
    }

    // Build update data - only include provided fields
    const updateData: Record<string, unknown> = {};

    // Allow updating these fields
    const allowedFields = [
      'direction',
      'step1_action',
      'step1_usd_value',
      'onsite_value_usd',
      'onsite_value_with_fee',
      'tx_hash',
      'onchain_usd_value',
      'gas_used_usd',
      'raw_profit_usd',
      'profit_with_gas_usd',
      'opponent',
      'priority_gwei',
      'opponent_trades_count',
      'opponent_time_gap_ms',
      'win',
      'api_call_duration_ms',
      'initial_reserves_rlb',
      'trade_amount_rlb',
      'trigger_category',
      'trigger_type',
      'block_number',
    ];

    for (const field of allowedFields) {
      if (data[field] !== undefined) {
        updateData[field] = data[field];
      }
    }

    // Auto-calculate profits if we have both sides
    const onsiteValue = data.onsite_value_with_fee ?? existingTrade.onsite_value_with_fee;
    const onchainValue = data.onchain_usd_value ?? existingTrade.onchain_usd_value;
    const gasUsed = data.gas_used_usd ?? existingTrade.gas_used_usd;
    const direction = data.direction ?? existingTrade.direction;

    if (onsiteValue !== null && onchainValue !== null && direction) {
      const onsiteNum = parseFloat(onsiteValue.toString());
      const onchainNum = parseFloat(onchainValue.toString());

      // Calculate raw profit: sell_side - buy_side
      let rawProfit: number | undefined;
      if (direction === 'buy_onsite_sell_onchain') {
        // Buy onsite (cost), sell onchain (revenue)
        rawProfit = onchainNum - onsiteNum;
      } else if (direction === 'sell_onsite_buy_onchain') {
        // Sell onsite (revenue), buy onchain (cost)
        rawProfit = onsiteNum - onchainNum;
      }

      if (rawProfit !== undefined) {
        updateData.raw_profit_usd = rawProfit;

        // Calculate profit with gas if gas is available
        if (gasUsed !== null) {
          const gasNum = parseFloat(gasUsed.toString());
          updateData.profit_with_gas_usd = rawProfit - gasNum;
        }
      }
    }

    const trade = await prisma.trade.update({
      where: { id: existingTrade.id },
      data: updateData,
    });

    return NextResponse.json({
      message: 'Trade updated successfully',
      trade: serializeTrade(trade),
    });
  } catch (error: any) {
    console.error('Error updating trade:', error);
    return NextResponse.json({
      error: 'Failed to update trade',
      details: error.message
    }, { status: 500 });
  }
}

// DELETE - Delete trade by ID
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ tradeId: string }> }
) {
  try {
    const { tradeId } = await params;

    // Build OR conditions - only include trade_number if it's a valid INT4
    const parsedNum = parseInt(tradeId);
    const canUseTradeNumber = !isNaN(parsedNum) && isValidInt4(parsedNum);

    // Find the trade first
    const existingTrade = await prisma.trade.findFirst({
      where: {
        OR: [
          { id: tradeId },
          { trade_id: tradeId },
          ...(canUseTradeNumber ? [{ trade_number: parsedNum }] : [])
        ]
      }
    });

    if (!existingTrade) {
      return NextResponse.json({ error: 'Trade not found' }, { status: 404 });
    }

    await prisma.trade.delete({
      where: { id: existingTrade.id }
    });

    return NextResponse.json({
      message: 'Trade deleted successfully',
      deletedTrade: {
        id: existingTrade.id,
        trade_id: existingTrade.trade_id,
      }
    });
  } catch (error: any) {
    console.error('Error deleting trade:', error);
    return NextResponse.json({
      error: 'Failed to delete trade',
      details: error.message
    }, { status: 500 });
  }
}
