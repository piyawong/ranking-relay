// Script to seed trade data into the database
const sampleTrades = [
  {
    "trade_number": 1,
    "timestamp": "2025-11-18T14:29:49.792807+00:00",
    "trigger_category": "onchain",
    "trigger_type": "fast_hook",
    "block_number": 23826602,
    "initial_reserves_rlb": 0.0,
    "trade_amount_rlb": 120000.0,
    "api_call_duration_ms": null,
    "opponent": false,
    "priority_gwei": null,
    "opponent_trades_count": null,
    "opponent_time_gap_ms": null,
    "trade_logs": null,
    "win": null
  },
  {
    "trade_number": 2,
    "timestamp": "2025-11-18T14:31:51.352968+00:00",
    "trigger_category": "onchain",
    "trigger_type": "fast_hook",
    "block_number": 23826612,
    "initial_reserves_rlb": 0.0,
    "trade_amount_rlb": 120000.0,
    "api_call_duration_ms": 45.5,
    "opponent": true,
    "priority_gwei": 3736.386,
    "opponent_trades_count": 1,
    "opponent_time_gap_ms": null,
    "trade_logs": [
      "Nov 18 14:31:51 included-slug bot[3255159]: 2025-11-18T14:31:51.398480Z  WARN rlb_arbitrage_bot::connection::rollbit: 💱 Rollbit RLB Trade: BUY 120000.00 RLB @ $0.060830 = $7284.48"
    ],
    "win": null
  },
  {
    "trade_number": 3,
    "timestamp": "2025-11-18T14:33:00.821582+00:00",
    "trigger_category": "onchain",
    "trigger_type": "fast_hook",
    "block_number": 23826617,
    "initial_reserves_rlb": 0.0,
    "trade_amount_rlb": 120000.0,
    "api_call_duration_ms": 402402.92,
    "opponent": false,
    "priority_gwei": null,
    "opponent_trades_count": null,
    "opponent_time_gap_ms": null,
    "trade_logs": null,
    "win": null
  },
  {
    "trade_number": 4,
    "timestamp": "2025-11-19T15:08:13.684912+00:00",
    "trigger_category": "onchain",
    "trigger_type": "fast_hook",
    "block_number": 23833914,
    "initial_reserves_rlb": 57565776.25,
    "trade_amount_rlb": 40000.0,
    "api_call_duration_ms": 78.59,
    "opponent": false,
    "priority_gwei": 1.062,
    "opponent_trades_count": null,
    "opponent_time_gap_ms": null,
    "trade_logs": null,
    "win": null
  },
  {
    "trade_number": 5,
    "timestamp": "2025-11-19T19:05:13.633407+00:00",
    "trigger_category": "onchain",
    "trigger_type": "fast_hook",
    "block_number": 23835086,
    "initial_reserves_rlb": 58314819.26,
    "trade_amount_rlb": 50000.0,
    "api_call_duration_ms": 48.25,
    "opponent": false,
    "priority_gwei": 0.411,
    "opponent_trades_count": null,
    "opponent_time_gap_ms": null,
    "trade_logs": null,
    "win": null
  },
  {
    "trade_number": 6,
    "timestamp": "2025-11-19T19:26:12.702139+00:00",
    "trigger_category": "onchain",
    "trigger_type": "fast_hook",
    "block_number": 23835190,
    "initial_reserves_rlb": 58356027.39,
    "trade_amount_rlb": 40000.0,
    "api_call_duration_ms": 56.94,
    "opponent": false,
    "priority_gwei": 0.454,
    "opponent_trades_count": null,
    "opponent_time_gap_ms": null,
    "trade_logs": null,
    "win": null
  },
  {
    "trade_number": 7,
    "timestamp": "2025-11-19T20:33:08.378696+00:00",
    "trigger_category": "onsite",
    "trigger_type": "rollbit_price_update",
    "block_number": 23835518,
    "initial_reserves_rlb": 58991873.77,
    "trade_amount_rlb": 80000.0,
    "api_call_duration_ms": 45.87,
    "opponent": true,
    "priority_gwei": 9.369,
    "opponent_trades_count": 2,
    "opponent_time_gap_ms": 22.02,
    "trade_logs": [
      "Nov 19 20:33:08 included-slug bot[2223468]: 2025-11-19T20:33:08.424570Z  WARN rlb_arbitrage_bot::connection::rollbit: 💱 Rollbit RLB Trade: BUY 80000.00 RLB @ $0.058791 = $4696.91",
      "Nov 19 20:33:08 included-slug bot[2223468]: 2025-11-19T20:33:08.446588Z  WARN rlb_arbitrage_bot::connection::rollbit: 💱 Rollbit RLB Trade: BUY 60000.00 RLB @ $0.058911 = $3531.06"
    ],
    "win": null
  },
  {
    "trade_number": 8,
    "timestamp": "2025-11-19T21:05:36.651224+00:00",
    "trigger_category": "onchain",
    "trigger_type": "fast_hook",
    "block_number": 23835680,
    "initial_reserves_rlb": 58980669.99,
    "trade_amount_rlb": 40000.0,
    "api_call_duration_ms": 41.55,
    "opponent": false,
    "priority_gwei": 0.982,
    "opponent_trades_count": null,
    "opponent_time_gap_ms": null,
    "trade_logs": null,
    "win": null
  },
  {
    "trade_number": 9,
    "timestamp": "2025-11-19T21:22:37.692619+00:00",
    "trigger_category": "onchain",
    "trigger_type": "fast_hook",
    "block_number": 23835765,
    "initial_reserves_rlb": 58945198.99,
    "trade_amount_rlb": 40000.0,
    "api_call_duration_ms": 62.9,
    "opponent": false,
    "priority_gwei": 0.511,
    "opponent_trades_count": null,
    "opponent_time_gap_ms": null,
    "trade_logs": null,
    "win": null
  },
  {
    "trade_number": 10,
    "timestamp": "2025-11-19T23:10:12.336969+00:00",
    "trigger_category": "onchain",
    "trigger_type": "fast_hook",
    "block_number": 23836298,
    "initial_reserves_rlb": 58795179.03,
    "trade_amount_rlb": 40000.0,
    "api_call_duration_ms": 47.22,
    "opponent": false,
    "priority_gwei": 0.628,
    "opponent_trades_count": null,
    "opponent_time_gap_ms": null,
    "trade_logs": null,
    "win": null
  },
  {
    "trade_number": 11,
    "timestamp": "2025-11-20T00:11:58.331082+00:00",
    "trigger_category": "onsite",
    "trigger_type": "rollbit_price_update",
    "block_number": 23836603,
    "initial_reserves_rlb": 58794112.61,
    "trade_amount_rlb": 55000.0,
    "api_call_duration_ms": 47.93,
    "opponent": false,
    "priority_gwei": 0.496,
    "opponent_trades_count": null,
    "opponent_time_gap_ms": null,
    "trade_logs": null,
    "win": null
  },
  {
    "trade_number": 12,
    "timestamp": "2025-11-20T02:55:49.742639+00:00",
    "trigger_category": "onchain",
    "trigger_type": "fast_hook",
    "block_number": 23837420,
    "initial_reserves_rlb": 58680019.69,
    "trade_amount_rlb": 60000.0,
    "api_call_duration_ms": 51.88,
    "opponent": false,
    "priority_gwei": 0.314,
    "opponent_trades_count": null,
    "opponent_time_gap_ms": null,
    "trade_logs": null,
    "win": null
  }
];

async function seedTrades() {
  try {
    console.log('Seeding trade data...');

    const response = await fetch('http://localhost:3000/api/trades', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(sampleTrades),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to seed trades: ${error}`);
    }

    const result = await response.json();
    console.log('Trades seeded successfully:', result);
  } catch (error) {
    console.error('Error seeding trades:', error);
  }
}

seedTrades();