import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { getSlotForExecutionBlock } from '@/lib/utils/fetch-block-data';

// GET - Fetch trades with optional filters and statistics
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const triggerCategory = searchParams.get('trigger_category');
    const triggerType = searchParams.get('trigger_type');
    const hasOpponent = searchParams.get('has_opponent');
    const isWin = searchParams.get('is_win');
    const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : undefined;
    const offset = searchParams.get('offset') ? parseInt(searchParams.get('offset')!) : 0;

    // Build where clause
    const where: any = {};
    if (triggerCategory) where.trigger_category = triggerCategory;
    if (triggerType) where.trigger_type = triggerType;
    if (hasOpponent !== null) where.opponent = hasOpponent === 'true';
    if (isWin !== null) where.win = isWin === 'true';

    // Fetch trades (sorted by most recent first)
    const trades = await prisma.trade.findMany({
      where,
      orderBy: { timestamp: 'desc' },
      take: limit,
      skip: offset,
    });

    // Fetch block data for bloxroute comparison
    // Get unique block numbers from trades and look up actual slots from beacon node
    const blockNumbers = Array.from(new Set(trades.filter(t => t.block_number !== null).map(t => t.block_number!)));

    // Look up actual slots for each execution block (queries beacon node)
    const executionToSlotMap = new Map<number, number>();
    const slotNumbers: number[] = [];

    for (const execBlock of blockNumbers) {
      const slot = await getSlotForExecutionBlock(execBlock);
      if (slot !== null) {
        executionToSlotMap.set(execBlock, slot);
        slotNumbers.push(slot);
      }
    }

    // Search nearby slots (±2) to account for any edge cases
    const slotSearchRange: number[] = [];
    slotNumbers.forEach(slot => {
      for (let i = -2; i <= 2; i++) {
        slotSearchRange.push(slot + i);
      }
    });
    const uniqueSlots = Array.from(new Set(slotSearchRange));

    // Fetch blocks with their relay details - search by slot numbers
    const blocks = await prisma.block.findMany({
      where: {
        OR: [
          { block_number: { in: uniqueSlots } },
          { execution_block_number: { in: blockNumbers } }
        ]
      },
      include: {
        relay_details: {
          orderBy: { arrival_order: 'asc' },
          take: 1 // Only get the first relay
        }
      }
    });

    // Create lookup maps for quick access
    const blockBySlot = new Map(blocks.map(b => [b.block_number, b]));
    const blockByExecution = new Map(blocks.filter(b => b.execution_block_number).map(b => [b.execution_block_number!, b]));

    // Calculate statistics
    const allTrades = await prisma.trade.findMany({ where });

    // Count wins: explicit wins OR no opponent (solo trades count as wins)
    const winningTrades = allTrades.filter(t => t.win === true || !t.opponent);
    const losingTrades = allTrades.filter(t => t.win === false && t.opponent);

    // Calculate win amount stats
    const winAmounts = winningTrades.map(t => parseFloat(t.trade_amount_rlb.toString()));
    const lossAmounts = losingTrades.map(t => parseFloat(t.trade_amount_rlb.toString()));

    // Calculate win/loss time gap stats (opponent_time_gap_ms)
    const winTimeGaps = winningTrades
      .filter(t => t.opponent && t.opponent_time_gap_ms !== null)
      .map(t => parseFloat(t.opponent_time_gap_ms!.toString()));
    const lossTimeGaps = losingTrades
      .filter(t => t.opponent_time_gap_ms !== null)
      .map(t => parseFloat(t.opponent_time_gap_ms!.toString()));

    const statistics = {
      total_trades: allTrades.length,
      by_trigger_category: {
        onchain: allTrades.filter(t => t.trigger_category === 'onchain').length,
        onsite: allTrades.filter(t => t.trigger_category === 'onsite').length,
      },
      by_trigger_type: {
        fast_hook: allTrades.filter(t => t.trigger_type === 'fast_hook').length,
        rollbit_price_update: allTrades.filter(t => t.trigger_type === 'rollbit_price_update').length,
      },
      by_trade_amount: allTrades.reduce((acc: any, trade) => {
        const amount = trade.trade_amount_rlb.toString();
        acc[amount] = (acc[amount] || 0) + 1;
        return acc;
      }, {}),
      total_volume_rlb: allTrades.reduce((sum, t) => sum + parseFloat(t.trade_amount_rlb.toString()), 0),
      with_opponent: allTrades.filter(t => t.opponent).length,
      without_opponent: allTrades.filter(t => !t.opponent).length,
      wins: winningTrades.length,
      losses: losingTrades.length,
      win_rate: null as number | null,
      // Win amount stats
      min_win_amount: winAmounts.length > 0 ? Math.min(...winAmounts) : null,
      max_win_amount: winAmounts.length > 0 ? Math.max(...winAmounts) : null,
      avg_win_amount: winAmounts.length > 0 ? winAmounts.reduce((sum, a) => sum + a, 0) / winAmounts.length : null,
      total_win_volume: winAmounts.length > 0 ? winAmounts.reduce((sum, a) => sum + a, 0) : 0,
      // Loss amount stats
      min_loss_amount: lossAmounts.length > 0 ? Math.min(...lossAmounts) : null,
      max_loss_amount: lossAmounts.length > 0 ? Math.max(...lossAmounts) : null,
      avg_loss_amount: lossAmounts.length > 0 ? lossAmounts.reduce((sum, a) => sum + a, 0) / lossAmounts.length : null,
      total_loss_volume: lossAmounts.length > 0 ? lossAmounts.reduce((sum, a) => sum + a, 0) : 0,
      // Win time gap stats (ms faster than opponent)
      min_win_time_gap_ms: winTimeGaps.length > 0 ? Math.min(...winTimeGaps) : null,
      max_win_time_gap_ms: winTimeGaps.length > 0 ? Math.max(...winTimeGaps) : null,
      avg_win_time_gap_ms: winTimeGaps.length > 0 ? winTimeGaps.reduce((sum, g) => sum + g, 0) / winTimeGaps.length : null,
      // Loss time gap stats (ms slower than opponent)
      min_loss_time_gap_ms: lossTimeGaps.length > 0 ? Math.min(...lossTimeGaps) : null,
      max_loss_time_gap_ms: lossTimeGaps.length > 0 ? Math.max(...lossTimeGaps) : null,
      avg_loss_time_gap_ms: lossTimeGaps.length > 0 ? lossTimeGaps.reduce((sum, g) => sum + g, 0) / lossTimeGaps.length : null,
      // API duration stats
      avg_api_duration_ms: null as number | null,
      min_api_duration_ms: null as number | null,
      max_api_duration_ms: null as number | null,
      avg_priority_gwei_with_opponent: null as number | null,
      avg_priority_gwei_without_opponent: null as number | null,
      avg_opponent_time_gap_ms: null as number | null,
      avg_api_duration_by_category: {
        onchain: null as number | null,
        onsite: null as number | null,
      }
    };

    // Calculate win rate
    const totalWinLoss = statistics.wins + statistics.losses;
    if (totalWinLoss > 0) {
      statistics.win_rate = (statistics.wins / totalWinLoss) * 100;
    }

    // Calculate API duration stats
    const tradesWithDuration = allTrades.filter(t => t.api_call_duration_ms !== null);
    if (tradesWithDuration.length > 0) {
      const durations = tradesWithDuration.map(t => parseFloat(t.api_call_duration_ms!.toString()));
      statistics.avg_api_duration_ms = durations.reduce((sum, d) => sum + d, 0) / durations.length;
      statistics.min_api_duration_ms = Math.min(...durations);
      statistics.max_api_duration_ms = Math.max(...durations);

      // By category
      const onchainDurations = tradesWithDuration
        .filter(t => t.trigger_category === 'onchain')
        .map(t => parseFloat(t.api_call_duration_ms!.toString()));
      const onsiteDurations = tradesWithDuration
        .filter(t => t.trigger_category === 'onsite')
        .map(t => parseFloat(t.api_call_duration_ms!.toString()));

      if (onchainDurations.length > 0) {
        statistics.avg_api_duration_by_category.onchain = onchainDurations.reduce((sum, d) => sum + d, 0) / onchainDurations.length;
      }
      if (onsiteDurations.length > 0) {
        statistics.avg_api_duration_by_category.onsite = onsiteDurations.reduce((sum, d) => sum + d, 0) / onsiteDurations.length;
      }
    }

    // Calculate priority gwei averages
    const tradesWithOpponentAndPriority = allTrades.filter(t => t.opponent && t.priority_gwei !== null);
    if (tradesWithOpponentAndPriority.length > 0) {
      const priorities = tradesWithOpponentAndPriority.map(t => parseFloat(t.priority_gwei!.toString()));
      statistics.avg_priority_gwei_with_opponent = priorities.reduce((sum, p) => sum + p, 0) / priorities.length;
    }

    const tradesWithoutOpponentAndPriority = allTrades.filter(t => !t.opponent && t.priority_gwei !== null);
    if (tradesWithoutOpponentAndPriority.length > 0) {
      const priorities = tradesWithoutOpponentAndPriority.map(t => parseFloat(t.priority_gwei!.toString()));
      statistics.avg_priority_gwei_without_opponent = priorities.reduce((sum, p) => sum + p, 0) / priorities.length;
    }

    // Calculate average opponent time gap
    const tradesWithTimeGap = allTrades.filter(t => t.opponent_time_gap_ms !== null);
    if (tradesWithTimeGap.length > 0) {
      const gaps = tradesWithTimeGap.map(t => parseFloat(t.opponent_time_gap_ms!.toString()));
      statistics.avg_opponent_time_gap_ms = gaps.reduce((sum, g) => sum + g, 0) / gaps.length;
    }

    return NextResponse.json({
      statistics,
      trades: trades.map(trade => {
        // Get the actual slot from beacon node lookup (cached in executionToSlotMap)
        const actualSlot = trade.block_number ? executionToSlotMap.get(trade.block_number) || null : null;

        // Try to find block by execution_block_number first, then by actual slot
        let block = trade.block_number ? blockByExecution.get(trade.block_number) : undefined;
        let matchedSlot = block?.block_number || null;

        if (!block && actualSlot) {
          // Search nearby slots (±2) for a match in our database
          for (let i = 0; i <= 2; i++) {
            block = blockBySlot.get(actualSlot + i) || blockBySlot.get(actualSlot - i);
            if (block) {
              matchedSlot = block.block_number;
              break;
            }
          }
        }

        const firstRelay = block?.relay_details?.[0];

        // Calculate bloxroute comparison
        let bloxrouteComparison: { is_win_relay: boolean | null; time_diff_ms: number | null; } = {
          is_win_relay: null,
          time_diff_ms: null
        };

        if (block && firstRelay?.arrival_timestamp && block.bloxroute_timestamp) {
          const relayTime = new Date(firstRelay.arrival_timestamp).getTime();
          const bloxrouteTime = new Date(block.bloxroute_timestamp).getTime();
          bloxrouteComparison = {
            is_win_relay: relayTime < bloxrouteTime,
            time_diff_ms: relayTime - bloxrouteTime // negative = relay won
          };
        }

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
          // Slot number (from beacon node lookup)
          slot_number: matchedSlot || actualSlot,
          // Block data for bloxroute comparison
          first_relay: firstRelay?.relay_name || null,
          bloxroute_origin: block?.origin || null,
          bloxroute_comparison: bloxrouteComparison,
        };
      })
    });
  } catch (error) {
    console.error('Error fetching trades:', error);
    return NextResponse.json({ error: 'Failed to fetch trades' }, { status: 500 });
  }
}

// POST - Create new trade or batch of trades
export async function POST(request: NextRequest) {
  try {
    const data = await request.json();

    // Check if it's a single trade or batch
    if (Array.isArray(data)) {
      // Batch insert with duplicate prevention
      const results = {
        created: 0,
        skipped: 0,
        errors: [] as string[]
      };

      for (const tradeData of data) {
        try {
          // Check for existing trade using trade_id or trade_number
          const existingTrade = await prisma.trade.findFirst({
            where: {
              OR: [
                tradeData.trade_id ? { trade_id: tradeData.trade_id } : {},
                tradeData.trade_number ? { trade_number: tradeData.trade_number } : {}
              ].filter(obj => Object.keys(obj).length > 0)
            }
          });

          if (existingTrade) {
            results.skipped++;
            console.log(`[Trades API] Skipped duplicate trade: ${tradeData.trade_id || tradeData.trade_number}`);
            continue;
          }

          // Create new trade
          await prisma.trade.create({
            data: {
              trade_id: tradeData.trade_id || null,
              trade_number: tradeData.trade_number || null,
              timestamp: new Date(tradeData.timestamp),
              trigger_category: tradeData.trigger_category,
              trigger_type: tradeData.trigger_type,
              block_number: tradeData.block_number,
              initial_reserves_rlb: tradeData.initial_reserves_rlb,
              trade_amount_rlb: tradeData.trade_amount_rlb,
              direction: tradeData.direction || null,
              step1_action: tradeData.step1_action || null,
              step1_usd_value: tradeData.step1_usd_value ?? null,
              onsite_value_usd: tradeData.onsite_value_usd ?? null,
              onsite_value_with_fee: tradeData.onsite_value_with_fee ?? null,
              tx_hash: tradeData.tx_hash || null,
              onchain_usd_value: tradeData.onchain_usd_value ?? null,
              gas_used_usd: tradeData.gas_used_usd ?? null,
              raw_profit_usd: tradeData.raw_profit_usd ?? null,
              profit_with_gas_usd: tradeData.profit_with_gas_usd ?? null,
              api_call_duration_ms: tradeData.api_call_duration_ms,
              opponent: tradeData.opponent || false,
              priority_gwei: tradeData.priority_gwei,
              opponent_trades_count: tradeData.opponent_trades_count,
              opponent_time_gap_ms: tradeData.opponent_time_gap_ms,
              trade_logs: Array.isArray(tradeData.trade_logs) ? tradeData.trade_logs : [],
              win: tradeData.win,
            }
          });
          results.created++;
        } catch (err: any) {
          results.errors.push(`Trade ${tradeData.trade_id || tradeData.trade_number}: ${err.message}`);
        }
      }

      return NextResponse.json({
        message: `Batch complete: ${results.created} created, ${results.skipped} skipped`,
        created: results.created,
        skipped: results.skipped,
        errors: results.errors.length > 0 ? results.errors : undefined
      });
    } else {
      // Single trade insert
      // Check for existing trade
      const existingTrade = await prisma.trade.findFirst({
        where: {
          OR: [
            data.trade_id ? { trade_id: data.trade_id } : {},
            data.trade_number ? { trade_number: data.trade_number } : {}
          ].filter(obj => Object.keys(obj).length > 0)
        }
      });

      if (existingTrade) {
        return NextResponse.json({
          error: 'Trade already exists',
          trade_id: existingTrade.trade_id || existingTrade.trade_number
        }, { status: 409 });
      }

      const trade = await prisma.trade.create({
        data: {
          trade_id: data.trade_id || null,
          trade_number: data.trade_number || null,
          timestamp: new Date(data.timestamp),
          trigger_category: data.trigger_category,
          trigger_type: data.trigger_type,
          block_number: data.block_number,
          initial_reserves_rlb: data.initial_reserves_rlb,
          trade_amount_rlb: data.trade_amount_rlb,
          direction: data.direction || null,
          step1_action: data.step1_action || null,
          step1_usd_value: data.step1_usd_value ?? null,
          onsite_value_usd: data.onsite_value_usd ?? null,
          onsite_value_with_fee: data.onsite_value_with_fee ?? null,
          tx_hash: data.tx_hash || null,
          onchain_usd_value: data.onchain_usd_value ?? null,
          gas_used_usd: data.gas_used_usd ?? null,
          raw_profit_usd: data.raw_profit_usd ?? null,
          profit_with_gas_usd: data.profit_with_gas_usd ?? null,
          api_call_duration_ms: data.api_call_duration_ms,
          opponent: data.opponent || false,
          priority_gwei: data.priority_gwei,
          opponent_trades_count: data.opponent_trades_count,
          opponent_time_gap_ms: data.opponent_time_gap_ms,
          trade_logs: Array.isArray(data.trade_logs) ? data.trade_logs : [],
          win: data.win,
        }
      });

      return NextResponse.json({
        message: 'Trade created successfully',
        trade: {
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
        }
      });
    }
  } catch (error: any) {
    console.error('Error creating trade:', error);

    // Handle unique constraint violation
    if (error.code === 'P2002') {
      const field = error.meta?.target?.includes('trade_id') ? 'trade_id' : 'trade_number';
      return NextResponse.json({
        error: `Trade with this ${field} already exists`
      }, { status: 409 });
    }

    return NextResponse.json({
      error: 'Failed to create trade',
      details: error.message
    }, { status: 500 });
  }
}

// DELETE - Delete trade by ID (database id, trade_id, or trade_number) or all trades
export async function DELETE(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const id = searchParams.get('id');
    const trade_id = searchParams.get('trade_id');
    const trade_number = searchParams.get('trade_number');
    const deleteAll = searchParams.get('all');

    // Handle delete all trades
    if (deleteAll === 'true') {
      const result = await prisma.trade.deleteMany({});
      return NextResponse.json({
        message: 'All trades deleted successfully',
        deletedCount: result.count
      });
    }

    if (!id && !trade_id && !trade_number) {
      return NextResponse.json({
        error: 'Must provide id, trade_id, trade_number, or all=true parameter'
      }, { status: 400 });
    }

    // Build where clause
    let where: any = {};
    if (id) {
      where = { id };
    } else if (trade_id) {
      where = { trade_id };
    } else if (trade_number) {
      where = { trade_number: parseInt(trade_number) };
    }

    const trade = await prisma.trade.delete({
      where
    });

    return NextResponse.json({
      message: 'Trade deleted successfully',
      deletedTrade: {
        id: trade.id,
        trade_id: trade.trade_id,
        trade_number: trade.trade_number
      }
    });
  } catch (error: any) {
    console.error('Error deleting trade:', error);

    if (error.code === 'P2025') {
      return NextResponse.json({
        error: 'Trade not found'
      }, { status: 404 });
    }

    return NextResponse.json({
      error: 'Failed to delete trade',
      details: error.message
    }, { status: 500 });
  }
}