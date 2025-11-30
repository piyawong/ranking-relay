# HTTP API List

This document lists all custom HTTP APIs available in the Grandine relay node.

## Peer APIs

### GET /peers
Get all connected peers with their RTT latency and address information.

**Response:**
```json
[
  {
    "peer_id": "16Uiu2...",
    "address": "/ip4/192.168.1.100/tcp/9000",
    "direction": "outbound",
    "state": "connected",
    "rtt_ms": 45.5,
    "best_rtt_ms": 42.1,
    "rtt_verified": true,
    "is_trusted": false,
    "client": "Lighthouse/v4.0.0"
  }
]
```

### POST /peers
Connect to a peer by ENR or multiaddr (without adding to trusted list).

**Request Body (ENR):**
```json
{
  "enr": "enr:-IS4QH..."
}
```

**Request Body (multiaddr):**
```json
{
  "multiaddr": "/ip4/192.168.1.100/tcp/9000/p2p/16Uiu2HAk..."
}
```

**Response:**
```json
{
  "status": "ok",
  "enr": "enr:-IS4QH...",
  "action": "connecting"
}
```

### GET /peers/{peer_id}
Get information about a specific peer.

**Response:**
```json
{
  "peer_id": "16Uiu2...",
  "address": "/ip4/192.168.1.100/tcp/9000",
  "direction": "outbound",
  "state": "connected",
  "rtt_ms": 45.5,
  "best_rtt_ms": 42.1,
  "rtt_verified": true,
  "is_trusted": false,
  "client": "Lighthouse/v4.0.0"
}
```

**Error Response (peer not found):**
```json
{
  "error": "peer not found"
}
```

### DELETE /peers/{peer_id}
Disconnect a peer and remove from trusted list if applicable.

**Response:**
```json
{
  "status": "ok",
  "peer_id": "16Uiu2...",
  "action": "disconnected"
}
```

## Trusted Peer APIs

### GET /peers/trusted
Get list of all trusted peers.

**Response:**
```json
[
  {
    "peer_id": "16Uiu2...",
    "enr": "enr:-IS4QH...",
    "is_connected": true
  }
]
```

### POST /peers/trusted
Add a trusted peer by ENR and dial it.

**Request Body:**
```json
{
  "enr": "enr:-IS4QH..."
}
```

**Response:**
```json
{
  "status": "ok",
  "enr": "enr:-IS4QH...",
  "action": "added"
}
```

### DELETE /peers/trusted/{peer_id}
Remove a trusted peer by peer ID (does not disconnect).

**Response:**
```json
{
  "status": "ok",
  "peer_id": "16Uiu2...",
  "action": "removed"
}
```

**Error Response (peer not found):**
```json
{
  "error": "peer not found in trusted list"
}
```

## Discovery APIs

### GET /discovery/stats
Get discovery statistics.

**Response:**
```json
{
  "unique_peers_discovered": 1234,
  "routing_table_size": 0,
  "cached_enrs": 0,
  "total_discovery_queries": 567,
  "dht_scan_prefix": 0,
  "kademlia_alpha": 3,
  "kademlia_k": 16,
  "target_peers_per_query": 16
}
```

### GET /discovery/peers
Get all unique peer IDs that have been discovered.

**Response:**
```json
[
  "16Uiu2HAkx...",
  "16Uiu2HAky..."
]
```

## Configuration APIs

### GET /config
Get current runtime peer configuration.

**Response:**
```json
{
  "target_peers": 80,
  "max_latency_ms": 150.0
}
```

### PATCH /config
Update runtime peer configuration. You can update one or both fields.

**Request Body:**
```json
{
  "target_peers": 100,
  "max_latency_ms": 200.0
}
```

**Response:**
```json
{
  "status": "ok",
  "target_peers": 100,
  "max_latency_ms": 200.0
}
```

## System APIs

### GET /system/stats
Get system statistics (requires metrics service).

**Response:** System metrics JSON object.

## API Summary

| Resource | GET | POST | PATCH | DELETE |
|----------|-----|------|-------|--------|
| `/peers` | List all peers | Connect peer | - | - |
| `/peers/{peer_id}` | Get peer info | - | - | Disconnect peer |
| `/peers/trusted` | List trusted | Add trusted | - | - |
| `/peers/trusted/{peer_id}` | - | - | - | Remove trusted |
| `/config` | Get config | - | Update config | - |
| `/discovery/stats` | Get stats | - | - | - |
| `/discovery/peers` | List discovered | - | - | - |

## Usage Examples

### Using curl

```bash
# Get all peers
curl http://localhost:5052/peers

# Get specific peer
curl http://localhost:5052/peers/16Uiu2HAkx...

# Connect to a peer using ENR
curl -X POST http://localhost:5052/peers \
  -H "Content-Type: application/json" \
  -d '{"enr": "enr:-IS4QH..."}'

# Connect to a peer using multiaddr
curl -X POST http://localhost:5052/peers \
  -H "Content-Type: application/json" \
  -d '{"multiaddr": "/ip4/192.168.1.100/tcp/9000/p2p/16Uiu2HAkx..."}'

# Disconnect a peer
curl -X DELETE http://localhost:5052/peers/16Uiu2HAkx...

# Get trusted peers
curl http://localhost:5052/peers/trusted

# Add a trusted peer
curl -X POST http://localhost:5052/peers/trusted \
  -H "Content-Type: application/json" \
  -d '{"enr": "enr:-IS4QH..."}'

# Remove a trusted peer
curl -X DELETE http://localhost:5052/peers/trusted/16Uiu2HAkx...

# Get current config
curl http://localhost:5052/config

# Update config
curl -X PATCH http://localhost:5052/config \
  -H "Content-Type: application/json" \
  -d '{"target_peers": 100, "max_latency_ms": 150.0}'

# Get discovery stats
curl http://localhost:5052/discovery/stats
```

## Notes

- All APIs are available on the HTTP API port (default: 5052)
- ENR format: Base64-encoded Ethereum Node Record starting with `enr:-`
- Multiaddr format: libp2p multiaddr (e.g., `/ip4/192.168.1.100/tcp/9000/p2p/16Uiu2HAk...`)
- Peer ID format: Base58-encoded libp2p peer ID (e.g., `16Uiu2HAk...`)
- Trusted peers are automatically reconnected if disconnected
- Peers added via `POST /peers` are not automatically reconnected
