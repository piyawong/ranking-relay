# Trades API Documentation

## Endpoint
`POST http://148.251.66.154:3000/api/trades`

## Purpose
Save trading performance data including execution timing, opponent detection, and trade outcomes.

---

## Request Format

### Single Trade
Send a JSON object with the following structure:

```json
{
  "trade_number": 1,
  "timestamp": "2025-11-24T12:30:00.000Z",
  "trigger_category": "onchain",
  "trigger_type": "fast_hook",
  "block_number": 12345678,
  "initial_reserves_rlb": 1000000.50,
  "trade_amount_rlb": 5000.25,
  "api_call_duration_ms": 123.45,
  "opponent": true,
  "priority_gwei": 2.5,
  "opponent_trades_count": 3,
  "opponent_time_gap_ms": 50.25,
  "trade_logs": [
    "Trade initiated at block 12345678",
    "Competitor detected",
    "Transaction submitted with 2.5 Gwei priority"
  ],
  "win": true
}
```

### Batch Trades
Send an array of trade objects:

```json
[
  {
    "trade_number": 1,
    "timestamp": "2025-11-24T12:30:00.000Z",
    ...
  },
  {
    "trade_number": 2,
    "timestamp": "2025-11-24T12:31:00.000Z",
    ...
  }
]
```

---

## Field Descriptions

### Required Fields

| Field | Type | Description | Example |
|-------|------|-------------|---------|
| `trade_number` | Integer | Unique trade identifier | `1` |
| `timestamp` | ISO 8601 String | When trade occurred | `"2025-11-24T12:30:00.000Z"` |
| `trigger_category` | String | Trade trigger category | `"onchain"` or `"onsite"` |
| `trigger_type` | String | Specific trigger type | `"fast_hook"` or `"rollbit_price_update"` |
| `block_number` | Integer | Blockchain block number | `12345678` |
| `initial_reserves_rlb` | Number | RLB reserves before trade | `1000000.50` |
| `trade_amount_rlb` | Number | RLB amount traded | `5000.25` |

### Optional Fields

| Field | Type | Description | Default | Example |
|-------|------|-------------|---------|---------|
| `api_call_duration_ms` | Number | API response time in milliseconds | `null` | `123.45` |
| `opponent` | Boolean | Whether trade had competition | `false` | `true` |
| `priority_gwei` | Number | Gas priority fee in Gwei | `null` | `2.5` |
| `opponent_trades_count` | Integer | Number of competing trades | `null` | `3` |
| `opponent_time_gap_ms` | Number | Time gap to opponent in ms | `null` | `50.25` |
| `trade_logs` | Array[String] | Execution log messages | `[]` | `["Log 1", "Log 2"]` |
| `win` | Boolean | Trade outcome (won/lost) | `null` | `true` |

---

## Field Constraints

### Enumerations
- **trigger_category**: Must be `"onchain"` or `"onsite"`
- **trigger_type**: Must be `"fast_hook"` or `"rollbit_price_update"`

### Numeric Precision
- **initial_reserves_rlb**: Up to 20 digits, 8 decimal places
- **trade_amount_rlb**: Up to 20 digits, 8 decimal places
- **api_call_duration_ms**: Up to 10 digits, 2 decimal places
- **priority_gwei**: Up to 10 digits, 3 decimal places
- **opponent_time_gap_ms**: Up to 10 digits, 2 decimal places

### Unique Constraint
- **trade_number** must be unique across all trades

---

## cURL Examples

### Single Trade (Onchain Fast Hook)
```bash
curl -X POST http://148.251.66.154:3000/api/trades \
  -H "Content-Type: application/json" \
  -d '{
    "trade_number": 1,
    "timestamp": "2025-11-24T12:30:00.000Z",
    "trigger_category": "onchain",
    "trigger_type": "fast_hook",
    "block_number": 12345678,
    "initial_reserves_rlb": 1000000.50,
    "trade_amount_rlb": 5000.25,
    "api_call_duration_ms": 123.45,
    "opponent": true,
    "priority_gwei": 2.5,
    "opponent_trades_count": 3,
    "opponent_time_gap_ms": 50.25,
    "trade_logs": [
      "Trade initiated",
      "Competitor detected",
      "Transaction submitted"
    ],
    "win": true
  }'
```

### Single Trade (Onsite Rollbit Update)
```bash
curl -X POST http://148.251.66.154:3000/api/trades \
  -H "Content-Type: application/json" \
  -d '{
    "trade_number": 2,
    "timestamp": "2025-11-24T12:35:00.000Z",
    "trigger_category": "onsite",
    "trigger_type": "rollbit_price_update",
    "block_number": 12345680,
    "initial_reserves_rlb": 995000.25,
    "trade_amount_rlb": 3000,
    "api_call_duration_ms": 98.50,
    "opponent": false
  }'
```

### Batch Trades
```bash
curl -X POST http://148.251.66.154:3000/api/trades \
  -H "Content-Type: application/json" \
  -d '[
    {
      "trade_number": 3,
      "timestamp": "2025-11-24T13:00:00.000Z",
      "trigger_category": "onchain",
      "trigger_type": "fast_hook",
      "block_number": 12345690,
      "initial_reserves_rlb": 1005000,
      "trade_amount_rlb": 2500,
      "opponent": false
    },
    {
      "trade_number": 4,
      "timestamp": "2025-11-24T13:05:00.000Z",
      "trigger_category": "onsite",
      "trigger_type": "rollbit_price_update",
      "block_number": 12345695,
      "initial_reserves_rlb": 1002500,
      "trade_amount_rlb": 1500,
      "api_call_duration_ms": 110.25,
      "opponent": true,
      "priority_gwei": 3.2,
      "win": false
    }
  ]'
```

---

## Response Format

### Success (Single Trade)
```json
{
  "message": "Trade created successfully",
  "trade": {
    "id": "uuid-here",
    "trade_number": 1,
    "timestamp": "2025-11-24T12:30:00.000Z",
    "trigger_category": "onchain",
    "trigger_type": "fast_hook",
    "block_number": 12345678,
    "initial_reserves_rlb": 1000000.5,
    "trade_amount_rlb": 5000.25,
    "api_call_duration_ms": 123.45,
    "opponent": true,
    "priority_gwei": 2.5,
    "opponent_trades_count": 3,
    "opponent_time_gap_ms": 50.25,
    "trade_logs": ["Trade initiated", "Competitor detected"],
    "win": true,
    "created_at": "2025-11-24T12:30:05.123Z",
    "updated_at": "2025-11-24T12:30:05.123Z"
  }
}
```

### Success (Batch)
```json
{
  "message": "Trades created successfully",
  "count": 2
}
```

### Error (Duplicate Trade Number)
```json
{
  "error": "Trade with this number already exists"
}
```
**HTTP Status:** `409 Conflict`

### Error (Validation)
```json
{
  "error": "Failed to create trade",
  "details": "Invalid trigger_category value"
}
```
**HTTP Status:** `500 Internal Server Error`

---

## Python Example

```python
import requests
from datetime import datetime

def save_trade(trade_data):
    url = "http://148.251.66.154:3000/api/trades"
    headers = {"Content-Type": "application/json"}

    response = requests.post(url, json=trade_data, headers=headers)

    if response.status_code == 200:
        print("Trade saved successfully:", response.json())
    elif response.status_code == 409:
        print("Duplicate trade number:", response.json())
    else:
        print("Error:", response.json())

    return response.json()

# Example usage
trade = {
    "trade_number": 10,
    "timestamp": datetime.utcnow().isoformat() + "Z",
    "trigger_category": "onchain",
    "trigger_type": "fast_hook",
    "block_number": 12345700,
    "initial_reserves_rlb": 1000000.0,
    "trade_amount_rlb": 5000.0,
    "api_call_duration_ms": 120.5,
    "opponent": True,
    "priority_gwei": 2.5,
    "opponent_trades_count": 2,
    "opponent_time_gap_ms": 45.0,
    "trade_logs": ["Trade started", "Executed successfully"],
    "win": True
}

save_trade(trade)
```

---

## Node.js Example

```javascript
const axios = require('axios');

async function saveTrade(tradeData) {
  try {
    const response = await axios.post(
      'http://148.251.66.154:3000/api/trades',
      tradeData,
      {
        headers: { 'Content-Type': 'application/json' }
      }
    );

    console.log('Trade saved:', response.data);
    return response.data;
  } catch (error) {
    if (error.response?.status === 409) {
      console.error('Duplicate trade number');
    } else {
      console.error('Error saving trade:', error.response?.data);
    }
    throw error;
  }
}

// Example usage
const trade = {
  trade_number: 11,
  timestamp: new Date().toISOString(),
  trigger_category: 'onsite',
  trigger_type: 'rollbit_price_update',
  block_number: 12345710,
  initial_reserves_rlb: 995000.0,
  trade_amount_rlb: 3000.0,
  api_call_duration_ms: 95.5,
  opponent: false
};

saveTrade(trade);
```

---

## Fetching Trades (GET)

### Get All Trades
```bash
curl http://148.251.66.154:3000/api/trades
```

### Filter by Trigger Category
```bash
curl "http://148.251.66.154:3000/api/trades?trigger_category=onchain"
```

### Filter by Opponent
```bash
curl "http://148.251.66.154:3000/api/trades?has_opponent=true"
```

### Filter by Win Status
```bash
curl "http://148.251.66.154:3000/api/trades?is_win=true"
```

### Multiple Filters with Pagination
```bash
curl "http://148.251.66.154:3000/api/trades?trigger_category=onchain&has_opponent=true&limit=50&offset=0"
```

### Response Includes Statistics
```json
{
  "statistics": {
    "total_trades": 150,
    "by_trigger_category": {
      "onchain": 90,
      "onsite": 60
    },
    "by_trigger_type": {
      "fast_hook": 100,
      "rollbit_price_update": 50
    },
    "total_volume_rlb": 750000.0,
    "with_opponent": 45,
    "without_opponent": 105,
    "wins": 38,
    "losses": 7,
    "win_rate": 84.4,
    "avg_api_duration_ms": 115.5,
    "avg_priority_gwei_with_opponent": 2.8,
    "avg_opponent_time_gap_ms": 48.5
  },
  "trades": [...]
}
```

---

## Best Practices

1. **Use batch insert** for multiple trades to reduce API calls
2. **Include trade_logs** for debugging and analysis
3. **Set opponent=true** and include timing data when competition detected
4. **Update win field** after trade confirmation
5. **Use consistent timestamp format** (ISO 8601 UTC)
6. **Handle 409 errors** (duplicate trade_number) gracefully
7. **Include api_call_duration_ms** to track performance

---

## Dashboard
View trade statistics and history at:
**http://148.251.66.154:3000/trades**

Features:
- Real-time statistics
- Win rate tracking
- Performance metrics
- Filter by category, type, opponent, result
- Response time analysis
- Volume tracking
