# HTTP API List

This document lists all custom HTTP APIs available in the Grandine relay node.

**Base URL:** `http://localhost:5052`

---

## Table of Contents

- [Health Check API](#health-check-api)
- [Node Info API](#node-info-api)
- [Peer APIs](#peer-apis)
- [Trusted Peer APIs](#trusted-peer-apis)
- [Banned Peer APIs](#banned-peer-apis)
- [Configuration APIs](#configuration-apis)
- [Discovery APIs](#discovery-apis)
- [Stats APIs](#stats-apis)
- [Mesh APIs](#mesh-apis)
- [API Summary Table](#api-summary-table)
- [Score Calculation](#score-calculation)
- [MESH Event Logs](#mesh-event-logs)

---

## Health Check API

### GET /eth/v1/node/health

Check the health status of the node (standard Beacon API).

**Response Status Codes:**
- `200 OK` - Node is fully synced and ready
- `206 Partial Content` - Node is syncing or not fully back-synced

**Example Request:**
```bash
curl -s -o /dev/null -w "%{http_code}" http://localhost:5052/eth/v1/node/health
```

**Example Response:**
```
200
```

---

## Node Info API

### GET /node/info

Get information about this node including its identity and network addresses.

**Example Request:**
```bash
curl http://localhost:5052/node/info
```

**Example Response:**
```json
{
  "peer_id": "16Uiu2HAmTH7nf3R5Ky5keaa9V21JL9jcjskHCXZZpr7VeUsnZk1m",
  "enr": "enr:-Ma4QP7Mh6szRFfT0poNgQPXFHU6U6i-S3fSK9M6gELm6UZoKihAK7xLZjH9qp_sVqb9EQjPx5oBq40jl1zx8NPd8HaGAZOPbBEqh2F0dG5ldHOIAAAAAAAAAACEZXRoMpCkZ-arBAAAAP__________gmlkgnY0gmlwhJo1N76EcXVpY4IjKYlzZWNwMjU2azGhA7zZDkkDw-e-R0E2G5mTaB2aGHaxbDIcP4dBBf7fIU6LiHN5bmNuZXRzAIN0Y3CCIyiDdWRwgiMo",
  "p2p_addresses": [
    "/ip4/154.53.55.190/tcp/9000/p2p/16Uiu2HAmTH7nf3R5Ky5keaa9V21JL9jcjskHCXZZpr7VeUsnZk1m"
  ],
  "discovery_addresses": [
    "/ip4/154.53.55.190/udp/9000/p2p/16Uiu2HAmTH7nf3R5Ky5keaa9V21JL9jcjskHCXZZpr7VeUsnZk1m"
  ],
  "metadata": {
    "seq_number": "1",
    "attnets": "0x0000000000000000",
    "syncnets": "0x00",
    "custody_group_count": "0"
  }
}
```

**Response Fields:**
| Field | Description |
|-------|-------------|
| `peer_id` | This node's libp2p peer ID (Base58-encoded) |
| `enr` | This node's Ethereum Node Record (Base64-encoded) |
| `p2p_addresses` | TCP multiaddrs for libp2p connections |
| `discovery_addresses` | UDP multiaddrs for discv5 discovery |
| `metadata.seq_number` | Metadata sequence number |
| `metadata.attnets` | Attestation subnet subscriptions |
| `metadata.syncnets` | Sync committee subnet subscriptions |
| `metadata.custody_group_count` | Data custody group count |

---

## Peer APIs

### GET /peers

Get all connected peers with their RTT latency and address information.

**Example Request:**
```bash
curl http://localhost:5052/peers
```

**Example Response:**
```json
[
  {
    "peer_id": "16Uiu2HAm4MqAN66Ey9CqUbSpSTCsEKHkYJH1h7oYrg8XDGXTMskH",
    "address": "/ip4/34.140.245.67/tcp/9000",
    "direction": "outbound",
    "state": "connected",
    "rtt_ms": 3.682368,
    "best_rtt_ms": 3.682368,
    "rtt_verified": true,
    "is_trusted": false,
    "score": -5.24,
    "peer_score": -5.0,
    "gossipsub_score": -200.0,
    "gossipsub_score_weighted": -0.24,
    "client": "Lighthouse/v6.0.1-6eb558b/x86_64-linux"
  },
  {
    "peer_id": "16Uiu2HAmRHMNvZRNfErnKhMrvX2gxPjtLfJinkrDmU1sJ2SsqdqF",
    "address": "/ip4/35.226.255.38/tcp/9000",
    "direction": "outbound",
    "state": "connected",
    "rtt_ms": 95.463082,
    "best_rtt_ms": 95.463082,
    "rtt_verified": true,
    "is_trusted": false,
    "score": 0.0,
    "peer_score": 0.0,
    "gossipsub_score": 0.0,
    "gossipsub_score_weighted": 0.0,
    "client": "Prysm/v5.2.0/75de4de7fa7c3076cf6c8151fce854bdfe6abf92"
  }
]
```

**Response Fields:**
| Field | Description |
|-------|-------------|
| `peer_id` | Peer's libp2p peer ID |
| `address` | Peer's multiaddr |
| `direction` | `"inbound"` or `"outbound"` |
| `state` | `"connected"`, `"connecting"`, `"disconnecting"`, or `"disconnected"` |
| `rtt_ms` | Latest round-trip time in milliseconds |
| `best_rtt_ms` | Best (lowest) RTT observed |
| `rtt_verified` | Whether RTT has been verified via PING/PONG |
| `is_trusted` | Whether peer is in trusted list |
| `score` | Combined final score = peer_score + gossipsub_score_weighted |
| `peer_score` | Score from peer actions (RPC errors, timeouts, protocol violations) |
| `gossipsub_score` | Raw gossipsub score before applying weight |
| `gossipsub_score_weighted` | Gossipsub score after applying weight (≈ gossipsub_score × 0.00119) |
| `client` | Peer's client version string |

> **See:** [Score Calculation](#score-calculation) for detailed explanation of how scores work.

---

### POST /peers

Connect to a peer by ENR or multiaddr (without adding to trusted list).

**Example Request (using ENR):**
```bash
curl -X POST http://localhost:5052/peers \
  -H "Content-Type: application/json" \
  -d '{
    "enr": "enr:-Ma4QCHId7a7GUtXvdqsYNJI_GvXeQVbvg7xQoit4NzaYPJa0LDFWGwQx-BqU_jHrYMW2_FiKcJTv9Zgnrp8oEpkHKOGAZOPYyaCh2F0dG5ldHOIAAAAAAAAAACEZXRoMpCkZ-arBAAAAP__________gmlkgnY0gmlwhJB-lloEcXVpY4IjKYlzZWNwMjU2azGhAkDqW6okS8vTh7QNNXK6rEM2vpmano4bOexcF27vM5kWiHN5bmNuZXRzAIN0Y3CCIyiDdWRwgiMo"
  }'
```

**Example Request (using multiaddr):**
```bash
curl -X POST http://localhost:5052/peers \
  -H "Content-Type: application/json" \
  -d '{
    "multiaddr": "/ip4/144.126.150.94/tcp/9000/p2p/16Uiu2HAmJB7R91zvvnx5P29vfuqpWUvjnCTKhrV4r8YgCpx1N56S"
  }'
```

**Example Response:**
```json
{
  "status": "ok",
  "enr": "enr:-Ma4QCHId7a7GUtXvdqsYNJI_GvXeQVbvg7xQoit4NzaYPJa0LDFWGwQx-BqU_jHrYMW2_FiKcJTv9Zgnrp8oEpkHKOGAZOPYyaCh2F0dG5ldHOIAAAAAAAAAACEZXRoMpCkZ-arBAAAAP__________gmlkgnY0gmlwhJB-lloEcXVpY4IjKYlzZWNwMjU2azGhAkDqW6okS8vTh7QNNXK6rEM2vpmano4bOexcF27vM5kWiHN5bmNuZXRzAIN0Y3CCIyiDdWRwgiMo",
  "action": "connecting"
}
```

---

### GET /peers/{peer_id}

Get information about a specific peer.

**Example Request:**
```bash
curl http://localhost:5052/peers/16Uiu2HAmJB7R91zvvnx5P29vfuqpWUvjnCTKhrV4r8YgCpx1N56S
```

**Example Response (success):**
```json
{
  "peer_id": "16Uiu2HAmJB7R91zvvnx5P29vfuqpWUvjnCTKhrV4r8YgCpx1N56S",
  "address": "/ip4/144.126.150.94/tcp/9000",
  "direction": "outbound",
  "state": "connected",
  "rtt_ms": 0.605547,
  "best_rtt_ms": 0.567299,
  "rtt_verified": true,
  "is_trusted": true,
  "score": 0.0,
  "peer_score": 0.0,
  "gossipsub_score": 0.0,
  "gossipsub_score_weighted": 0.0,
  "client": "Grandine/0.5.2-unstable/aarch64-linux"
}
```

**Example Response (peer not found):**
```json
{
  "error": "peer not found"
}
```

---

### DELETE /peers/{peer_id}

Disconnect a peer (does not remove from trusted list).

**Example Request:**
```bash
curl -X DELETE http://localhost:5052/peers/16Uiu2HAmJB7R91zvvnx5P29vfuqpWUvjnCTKhrV4r8YgCpx1N56S
```

**Example Response:**
```json
{
  "status": "ok",
  "peer_id": "16Uiu2HAmJB7R91zvvnx5P29vfuqpWUvjnCTKhrV4r8YgCpx1N56S",
  "action": "disconnected"
}
```

---

## Trusted Peer APIs

Trusted peers are automatically reconnected if disconnected.

### GET /peers/trusted

Get list of all trusted peers.

**Example Request:**
```bash
curl http://localhost:5052/peers/trusted
```

**Example Response:**
```json
[
  {
    "peer_id": "16Uiu2HAmJB7R91zvvnx5P29vfuqpWUvjnCTKhrV4r8YgCpx1N56S",
    "enr": "enr:-Ma4QCHId7a7GUtXvdqsYNJI_GvXeQVbvg7xQoit4NzaYPJa0LDFWGwQx-BqU_jHrYMW2_FiKcJTv9Zgnrp8oEpkHKOGAZOPYyaCh2F0dG5ldHOIAAAAAAAAAACEZXRoMpCkZ-arBAAAAP__________gmlkgnY0gmlwhJB-lloEcXVpY4IjKYlzZWNwMjU2azGhAkDqW6okS8vTh7QNNXK6rEM2vpmano4bOexcF27vM5kWiHN5bmNuZXRzAIN0Y3CCIyiDdWRwgiMo",
    "is_connected": true
  }
]
```

**Response Fields:**
| Field | Description |
|-------|-------------|
| `peer_id` | Trusted peer's libp2p peer ID |
| `enr` | Trusted peer's ENR |
| `is_connected` | Whether the peer is currently connected |

---

### POST /peers/trusted

Add a trusted peer by ENR and dial it.

**Example Request:**
```bash
curl -X POST http://localhost:5052/peers/trusted \
  -H "Content-Type: application/json" \
  -d '{
    "enr": "enr:-Ma4QCHId7a7GUtXvdqsYNJI_GvXeQVbvg7xQoit4NzaYPJa0LDFWGwQx-BqU_jHrYMW2_FiKcJTv9Zgnrp8oEpkHKOGAZOPYyaCh2F0dG5ldHOIAAAAAAAAAACEZXRoMpCkZ-arBAAAAP__________gmlkgnY0gmlwhJB-lloEcXVpY4IjKYlzZWNwMjU2azGhAkDqW6okS8vTh7QNNXK6rEM2vpmano4bOexcF27vM5kWiHN5bmNuZXRzAIN0Y3CCIyiDdWRwgiMo"
  }'
```

**Example Response:**
```json
{
  "status": "ok",
  "enr": "enr:-Ma4QCHId7a7GUtXvdqsYNJI_GvXeQVbvg7xQoit4NzaYPJa0LDFWGwQx-BqU_jHrYMW2_FiKcJTv9Zgnrp8oEpkHKOGAZOPYyaCh2F0dG5ldHOIAAAAAAAAAACEZXRoMpCkZ-arBAAAAP__________gmlkgnY0gmlwhJB-lloEcXVpY4IjKYlzZWNwMjU2azGhAkDqW6okS8vTh7QNNXK6rEM2vpmano4bOexcF27vM5kWiHN5bmNuZXRzAIN0Y3CCIyiDdWRwgiMo",
  "action": "added"
}
```

---

### POST /peers/trusted/{peer_id}

Add a **currently connected** peer to trusted list by peer ID (without dialing).

> **Note:** The peer must already be connected. This endpoint does not initiate a connection.

**Example Request:**
```bash
curl -X POST http://localhost:5052/peers/trusted/16Uiu2HAmJB7R91zvvnx5P29vfuqpWUvjnCTKhrV4r8YgCpx1N56S
```

**Example Response (success):**
```json
{
  "status": "ok",
  "peer_id": "16Uiu2HAmJB7R91zvvnx5P29vfuqpWUvjnCTKhrV4r8YgCpx1N56S",
  "action": "added"
}
```

**Example Response (peer not connected):**
```json
{
  "error": "peer not connected"
}
```

**Example Response (peer has no ENR):**
```json
{
  "error": "peer has no ENR"
}
```

---

### DELETE /peers/trusted/{peer_id}

Remove a trusted peer by peer ID (does not disconnect the peer).

**Example Request:**
```bash
curl -X DELETE http://localhost:5052/peers/trusted/16Uiu2HAmJB7R91zvvnx5P29vfuqpWUvjnCTKhrV4r8YgCpx1N56S
```

**Example Response (success):**
```json
{
  "status": "ok",
  "peer_id": "16Uiu2HAmJB7R91zvvnx5P29vfuqpWUvjnCTKhrV4r8YgCpx1N56S",
  "action": "removed"
}
```

**Example Response (peer not found):**
```json
{
  "error": "peer not found in trusted list"
}
```

---

## Banned Peer APIs

### GET /peers/banned

Get list of all banned peers (both permanent and temporary).

**Example Request:**
```bash
curl http://localhost:5052/peers/banned
```

**Example Response:**
```json
[
  {
    "peer_id": "16Uiu2HAmJB7R91zvvnx5P29vfuqpWUvjnCTKhrV4r8YgCpx1N56S",
    "ban_type": "permanent"
  },
  {
    "peer_id": "16Uiu2HAm4MqAN66Ey9CqUbSpSTCsEKHkYJH1h7oYrg8XDGXTMskH",
    "ban_type": "temporary"
  }
]
```

**Response Fields:**
| Field | Description |
|-------|-------------|
| `peer_id` | Banned peer's libp2p peer ID |
| `ban_type` | `"permanent"` (manually banned via API or loaded from `--ban-peers-file`) or `"temporary"` (banned by peer scoring, auto-unbans after ~30 min) |

> **Note:** Peers loaded from `--ban-peers-file` at startup are included as `"permanent"` bans.

---

### POST /peers/{peer_id}/ban

Permanently ban a peer. This will:
- Disconnect the peer if currently connected
- Remove the peer from trusted list if applicable
- Prevent future connections until manually unbanned

**Example Request:**
```bash
curl -X POST http://localhost:5052/peers/16Uiu2HAmJB7R91zvvnx5P29vfuqpWUvjnCTKhrV4r8YgCpx1N56S/ban
```

**Example Response:**
```json
{
  "status": "ok",
  "peer_id": "16Uiu2HAmJB7R91zvvnx5P29vfuqpWUvjnCTKhrV4r8YgCpx1N56S",
  "action": "banned"
}
```

---

### DELETE /peers/{peer_id}/ban

Unban a permanently banned peer.

**Example Request:**
```bash
curl -X DELETE http://localhost:5052/peers/16Uiu2HAmJB7R91zvvnx5P29vfuqpWUvjnCTKhrV4r8YgCpx1N56S/ban
```

**Example Response (success):**
```json
{
  "status": "ok",
  "peer_id": "16Uiu2HAmJB7R91zvvnx5P29vfuqpWUvjnCTKhrV4r8YgCpx1N56S",
  "action": "unbanned"
}
```

**Example Response (peer not found):**
```json
{
  "error": "peer not found in banned list"
}
```

> **Note:** Unban only works for permanently banned peers. Temporarily banned peers (from peer scoring) will auto-unban after ~30 minutes.

---

## Configuration APIs

### GET /config

Get current runtime peer configuration.

**Example Request:**
```bash
curl http://localhost:5052/config
```

**Example Response:**
```json
{
  "target_peers": 80,
  "max_latency_ms": 150.0,
  "network_load": 5
}
```

**Response Fields:**
| Field | Description |
|-------|-------------|
| `target_peers` | Target number of connected peers |
| `max_latency_ms` | Maximum allowed peer latency in milliseconds |
| `network_load` | Network load level (1-20). Controls gossipsub mesh size and heartbeat interval. **Takes effect immediately on next heartbeat.** |

**Network Load Levels:**
| Level | Name | mesh_n | mesh_n_low | mesh_n_high | Heartbeat |
|-------|------|--------|------------|-------------|-----------|
| 1 | Low | 3 | 1 | 4 | 1200ms |
| 2 | Low | 4 | 2 | 8 | 1000ms |
| 3 | Average | 5 | 3 | 10 | 1000ms |
| 4 | Average | 8 | 4 | 10 | 1000ms |
| 5 | High | 10 | 5 | 15 | 700ms |
| 6 | VeryHigh | 12 | 6 | 18 | 600ms |
| 7 | VeryHigh | 14 | 7 | 21 | 600ms |
| 8 | Ultra | 16 | 8 | 24 | 500ms |
| 9 | Ultra | 18 | 9 | 27 | 500ms |
| 10 | Maximum | 20 | 10 | 30 | 400ms |
| 11 | Extreme | 22 | 11 | 33 | 400ms |
| 12 | Extreme | 24 | 12 | 36 | 350ms |
| 13 | Extreme | 26 | 13 | 39 | 350ms |
| 14 | Turbo | 28 | 14 | 42 | 300ms |
| 15 | Turbo | 30 | 15 | 45 | 300ms |
| 16 | Hyper | 32 | 16 | 48 | 250ms |
| 17 | Hyper | 34 | 17 | 51 | 250ms |
| 18 | Insane | 36 | 18 | 54 | 200ms |
| 19 | Insane | 38 | 19 | 57 | 200ms |
| 20+ | Ludicrous | 40 | 20 | 60 | 200ms |

---

### PATCH /config

Update runtime peer configuration. You can update one or more fields.

**Example Request (update multiple fields):**
```bash
curl -X PATCH http://localhost:5052/config \
  -H "Content-Type: application/json" \
  -d '{
    "target_peers": 100,
    "max_latency_ms": 200.0,
    "network_load": 6
  }'
```

**Example Request (update only max_latency_ms):**
```bash
curl -X PATCH http://localhost:5052/config \
  -H "Content-Type: application/json" \
  -d '{
    "max_latency_ms": 175.5
  }'
```

**Example Request (update only network_load):**
```bash
curl -X PATCH http://localhost:5052/config \
  -H "Content-Type: application/json" \
  -d '{
    "network_load": 8
  }'
```

**Example Response:**
```json
{
  "status": "ok",
  "target_peers": 100,
  "max_latency_ms": 200.0,
  "network_load": 6
}
```

> **Note:** Changes to `network_load` take effect immediately on the next gossipsub heartbeat cycle. Both mesh parameters and heartbeat interval are updated at runtime.

---

## Discovery APIs

### GET /discovery/stats

Get discovery statistics.

**Example Request:**
```bash
curl http://localhost:5052/discovery/stats
```

**Example Response:**
```json
{
  "unique_peers_discovered": 3127,
  "routing_table_size": 0,
  "cached_enrs": 0,
  "total_discovery_queries": 891,
  "dht_scan_prefix": 0,
  "kademlia_alpha": 3,
  "kademlia_k": 16,
  "target_peers_per_query": 16
}
```

**Response Fields:**
| Field | Description |
|-------|-------------|
| `unique_peers_discovered` | Total unique peers discovered |
| `routing_table_size` | Current routing table size |
| `cached_enrs` | Number of cached ENRs |
| `total_discovery_queries` | Total discovery queries made |
| `dht_scan_prefix` | Current DHT scan prefix |
| `kademlia_alpha` | Kademlia alpha parameter |
| `kademlia_k` | Kademlia k parameter |
| `target_peers_per_query` | Target peers per discovery query |

---

### GET /discovery/peers

Get all unique peer IDs that have been discovered.

**Example Request:**
```bash
curl http://localhost:5052/discovery/peers
```

**Example Response:**
```json
[
  "16Uiu2HAmJB7R91zvvnx5P29vfuqpWUvjnCTKhrV4r8YgCpx1N56S",
  "16Uiu2HAm4MqAN66Ey9CqUbSpSTCsEKHkYJH1h7oYrg8XDGXTMskH",
  "16Uiu2HAmRHMNvZRNfErnKhMrvX2gxPjtLfJinkrDmU1sJ2SsqdqF"
]
```

---

## Stats APIs

### GET /stats/first-block-sender

Get statistics on which peers sent us blocks first. Only counts blocks that were received for the first time (not duplicates). Results are sorted by count in descending order.

**Example Request:**
```bash
curl http://localhost:5052/stats/first-block-sender
```

**Example Response:**
```json
[
  {
    "peer_id": "16Uiu2HAmJB7R91zvvnx5P29vfuqpWUvjnCTKhrV4r8YgCpx1N56S",
    "count": 152
  },
  {
    "peer_id": "16Uiu2HAm4MqAN66Ey9CqUbSpSTCsEKHkYJH1h7oYrg8XDGXTMskH",
    "count": 89
  },
  {
    "peer_id": "16Uiu2HAmRHMNvZRNfErnKhMrvX2gxPjtLfJinkrDmU1sJ2SsqdqF",
    "count": 45
  }
]
```

**Response Fields:**
| Field | Description |
|-------|-------------|
| `peer_id` | Peer's libp2p peer ID |
| `count` | Number of times this peer sent us a block first |

> **Note:** This counts only the first time we receive each block via gossipsub. Duplicate block messages from other peers are not counted. This helps identify which peers are the most valuable sources for new blocks.

---

## Mesh APIs

Gossipsub mesh management endpoints. The mesh is the set of peers we're directly connected to for each topic in the gossipsub protocol.

### GET /mesh

Get all gossipsub topics and the peers in each topic's mesh.

**Example Request:**
```bash
curl http://localhost:5052/mesh
```

**Example Response:**
```json
[
  {
    "topic": "/eth2/a4e6abeb/beacon_block/ssz_snappy",
    "kind": "BeaconBlock",
    "peers": [
      {
        "peer_id": "16Uiu2HAmJB7R91zvvnx5P29vfuqpWUvjnCTKhrV4r8YgCpx1N56S",
        "client": "Lighthouse/v6.0.1-6eb558b/x86_64-linux"
      },
      {
        "peer_id": "16Uiu2HAm4MqAN66Ey9CqUbSpSTCsEKHkYJH1h7oYrg8XDGXTMskH",
        "client": "Prysm/v5.2.0/75de4de7fa7c3076cf6c8151fce854bdfe6abf92"
      }
    ]
  },
  {
    "topic": "/eth2/a4e6abeb/beacon_aggregate_and_proof/ssz_snappy",
    "kind": "BeaconAggregateAndProof",
    "peers": [
      {
        "peer_id": "16Uiu2HAmRHMNvZRNfErnKhMrvX2gxPjtLfJinkrDmU1sJ2SsqdqF",
        "client": "Teku/25.6.0/linux-x86_64/-eclipse-temurin-21"
      }
    ]
  }
]
```

**Response Fields:**
| Field | Description |
|-------|-------------|
| `topic` | Full gossipsub topic name |
| `kind` | Topic type (BeaconBlock, BeaconAggregateAndProof, Attestation, etc.) |
| `peers` | List of peers in this topic's mesh |
| `peers[].peer_id` | Peer's libp2p peer ID |
| `peers[].client` | Peer's client version string |

---

### POST /mesh/explicit/{peer_id}

Add a peer to the gossipsub explicit peer list. Explicit peers are always included in the mesh regardless of their score.

> **Note:** This is useful for ensuring a specific peer always receives messages from us.

**Example Request:**
```bash
curl -X POST http://localhost:5052/mesh/explicit/16Uiu2HAmJB7R91zvvnx5P29vfuqpWUvjnCTKhrV4r8YgCpx1N56S
```

**Example Response:**
```json
{
  "status": "ok",
  "peer_id": "16Uiu2HAmJB7R91zvvnx5P29vfuqpWUvjnCTKhrV4r8YgCpx1N56S",
  "action": "added_to_explicit"
}
```

---

### DELETE /mesh/explicit/{peer_id}

Remove a peer from the gossipsub explicit peer list.

**Example Request:**
```bash
curl -X DELETE http://localhost:5052/mesh/explicit/16Uiu2HAmJB7R91zvvnx5P29vfuqpWUvjnCTKhrV4r8YgCpx1N56S
```

**Example Response:**
```json
{
  "status": "ok",
  "peer_id": "16Uiu2HAmJB7R91zvvnx5P29vfuqpWUvjnCTKhrV4r8YgCpx1N56S",
  "action": "removed_from_explicit"
}
```

---

### POST /mesh/{topic}/{peer_id}

Manually GRAFT a peer into a specific topic's mesh. This sends a GRAFT message to the peer and adds them to our mesh for that topic.

> **Note:** The peer must be connected and subscribed to the topic. Use `GET /mesh` to find the exact topic string.

**Example Request:**
```bash
curl -X POST "http://localhost:5052/mesh/%2Feth2%2Fa4e6abeb%2Fbeacon_block%2Fssz_snappy/16Uiu2HAmJB7R91zvvnx5P29vfuqpWUvjnCTKhrV4r8YgCpx1N56S"
```

> **Note:** The topic string must be URL-encoded. `/eth2/a4e6abeb/beacon_block/ssz_snappy` becomes `%2Feth2%2Fa4e6abeb%2Fbeacon_block%2Fssz_snappy`.

**Example Response (success - peer added):**
```json
{
  "status": "ok",
  "topic": "/eth2/a4e6abeb/beacon_block/ssz_snappy",
  "peer_id": "16Uiu2HAmJB7R91zvvnx5P29vfuqpWUvjnCTKhrV4r8YgCpx1N56S",
  "action": "grafted"
}
```

**Example Response (peer already in mesh):**
```json
{
  "status": "ok",
  "topic": "/eth2/a4e6abeb/beacon_block/ssz_snappy",
  "peer_id": "16Uiu2HAmJB7R91zvvnx5P29vfuqpWUvjnCTKhrV4r8YgCpx1N56S",
  "action": "already_in_mesh"
}
```

**Possible Errors:**
| Error | Description |
|-------|-------------|
| `peer not connected` | The peer is not currently connected |
| `peer not subscribed to topic` | The peer is not subscribed to this gossipsub topic |
| `not subscribed to topic` | We are not subscribed to this topic |

---

### DELETE /mesh/{topic}/{peer_id}

Manually PRUNE a peer from a specific topic's mesh. This sends a PRUNE message to the peer and removes them from our mesh for that topic.

**Example Request:**
```bash
curl -X DELETE "http://localhost:5052/mesh/%2Feth2%2Fa4e6abeb%2Fbeacon_block%2Fssz_snappy/16Uiu2HAmJB7R91zvvnx5P29vfuqpWUvjnCTKhrV4r8YgCpx1N56S"
```

**Example Response (success - peer removed):**
```json
{
  "status": "ok",
  "topic": "/eth2/a4e6abeb/beacon_block/ssz_snappy",
  "peer_id": "16Uiu2HAmJB7R91zvvnx5P29vfuqpWUvjnCTKhrV4r8YgCpx1N56S",
  "action": "pruned"
}
```

**Example Response (peer not in mesh):**
```json
{
  "status": "ok",
  "topic": "/eth2/a4e6abeb/beacon_block/ssz_snappy",
  "peer_id": "16Uiu2HAmJB7R91zvvnx5P29vfuqpWUvjnCTKhrV4r8YgCpx1N56S",
  "action": "not_in_mesh"
}
```

**Possible Errors:**
| Error | Description |
|-------|-------------|
| `not subscribed to topic` | We are not subscribed to this topic |

---

## API Summary Table

| Resource | GET | POST | PATCH | DELETE |
|----------|-----|------|-------|--------|
| `/eth/v1/node/health` | Health check | - | - | - |
| `/node/info` | Get node info | - | - | - |
| `/peers` | List all peers | Connect to peer | - | - |
| `/peers/{peer_id}` | Get peer info | - | - | Disconnect peer |
| `/peers/{peer_id}/ban` | - | Ban peer | - | Unban peer |
| `/peers/trusted` | List trusted | Add trusted | - | - |
| `/peers/trusted/{peer_id}` | - | Add connected peer | - | Remove trusted |
| `/peers/banned` | List banned | - | - | - |
| `/config` | Get config | - | Update config | - |
| `/discovery/stats` | Get stats | - | - | - |
| `/discovery/peers` | List discovered | - | - | - |
| `/stats/first-block-sender` | First block stats | - | - | - |
| `/mesh` | List mesh peers | - | - | - |
| `/mesh/{topic}/{peer_id}` | - | GRAFT peer to mesh | - | PRUNE peer from mesh |
| `/mesh/explicit/{peer_id}` | - | Add explicit | - | Remove explicit |

---

## Score Calculation

Peer scores determine connection quality and affect mesh membership. Understanding scores helps debug peer issues.

### Combined Score Formula

```
score = peer_score + gossipsub_score_weighted
```

Where:
- `gossipsub_score_weighted = gossipsub_score × weight`
- `weight ≈ 0.00119` (calculated from MIN_SCORE_BEFORE_DISCONNECT / GOSSIPSUB_GREYLIST_THRESHOLD = -19 / -16000)

### Score States

| Score Range | State | Effect |
|-------------|-------|--------|
| > -20 | Healthy | Normal operation |
| -20 to -50 | ForcedDisconnect | Peer disconnected, can reconnect |
| ≤ -50 | Banned | Peer banned for 12 hours |

**Special case:** If `peer_score ≤ -60`, peer is immediately banned regardless of gossipsub_score.

### Peer Score (peer_score)

Score from peer behavior in RPC/network operations. Decays to 0 with half-life of 600 seconds.

| Action | Score Change | ~Times to Ban |
|--------|-------------|---------------|
| Fatal | -100 | 1 (immediate) |
| LowToleranceError | -10 | ~5 |
| MidToleranceError | -5 | ~10 |
| HighToleranceError | -1 | ~50 |

**Examples of actions:**
- Fatal: Protocol violations, invalid responses
- LowTolerance: Timeout, connection failures
- MidTolerance: Invalid block/attestation
- HighTolerance: Minor errors

### Gossipsub Score (gossipsub_score)

Combined score from all gossipsub topics and peer-level penalties.

#### Topic Scores (Per-Topic)

Each subscribed topic contributes to the gossipsub score:

| Topic | Weight | Description |
|-------|--------|-------------|
| BeaconBlock | 0.5 | Most important - block propagation |
| BeaconAggregateAndProof | 0.5 | Aggregated attestations |
| Attestation (×64 subnets) | 0.015625 each | Raw attestations per subnet |
| VoluntaryExit | 0.05 | Validator exits |
| AttesterSlashing | 0.05 | Slashing evidence |
| ProposerSlashing | 0.05 | Slashing evidence |

#### Per-Topic Score Components

For each topic, score is calculated from:

| Component | Description | Effect |
|-----------|-------------|--------|
| P1: time_in_mesh | Time peer has been in our mesh | + (positive) |
| P2: first_message_deliveries | Peer delivered messages first | + (positive) |
| P3: mesh_message_deliveries | Deficit vs expected deliveries | - (penalty) |
| P3b: mesh_failure_penalty | Penalty for leaving mesh | - (penalty) |
| P4: invalid_message_deliveries | Sent invalid messages | - (penalty) |

```
topic_score = (P1 + P2 + P3 + P3b + P4) × topic_weight
```

#### Peer-Level Penalties

Additional penalties applied to total gossipsub score:

| Penalty | Trigger | Description |
|---------|---------|-------------|
| P6: ip_colocation | > 8 peers from same IP | Penalty = surplus² × weight |
| P7: behaviour_penalty | Bad behavior patterns | From gossipsub protocol |
| slow_peer_penalty | Slow message consumption | Peer can't keep up |

### Score Interpretation

| gossipsub_score | gossipsub_score_weighted | Meaning |
|-----------------|--------------------------|---------|
| 0 | 0 | Normal/neutral peer |
| +1000 | +1.19 | Good performer |
| -1000 | -1.19 | Below average |
| -16000 | -19.0 | At greylist threshold |

**Note:** Due to the low weight (~0.00119), gossipsub_score alone rarely causes disconnection. It takes a score of approximately -16,800 to contribute -20 to the combined score.

### Example Score Breakdown

```json
{
  "score": -5.24,
  "peer_score": -5.0,           // 1 LowToleranceError (-5) + decay
  "gossipsub_score": -200.0,    // Slight negative from topic performance
  "gossipsub_score_weighted": -0.24  // -200 × 0.00119 = -0.24
}
```

Combined: `-5.0 + (-0.24) = -5.24` (Healthy, no action taken)

---

## MESH Event Logs

The node logs gossipsub mesh events at INFO level. These logs help monitor mesh membership changes.

### Log Format

All mesh logs use the prefix `MESH:` for easy filtering:

```bash
# Filter only MESH logs
journalctl -u relay | grep "MESH:"
```

### When Peer GRAFTs Us (peer adds us to their mesh)

```
MESH: Received GRAFT from peer (peer wants to add us to their mesh) | peer=16Uiu2HAm... | topic=/eth2/.../beacon_block/ssz_snappy
MESH: We added peer to our mesh (accepted peer's GRAFT) | peer=16Uiu2HAm... | topic=/eth2/.../beacon_block/ssz_snappy
```

### When We Reject GRAFT (with reason)

```
MESH: We rejected peer's GRAFT and will PRUNE (reason: negative_score) | peer=16Uiu2HAm... | topic=... | score=-5.0
MESH: We rejected peer's GRAFT and will PRUNE (reason: backoff) | peer=16Uiu2HAm... | topic=...
MESH: We rejected peer's GRAFT and will PRUNE (reason: explicit_peer) | peer=16Uiu2HAm... | topic=...
```

### When Peer PRUNEs Us (peer removes us from their mesh)

```
MESH: Received PRUNE from peer (peer removed us from their mesh) | peer=16Uiu2HAm... | topic=... | backoff_secs=Some(60)
MESH: We removed peer from our mesh (responding to peer's PRUNE) | peer=16Uiu2HAm... | topic=...
```

### When We GRAFT Peer (we add peer to our mesh)

| Reason | Description |
|--------|-------------|
| `manual` | Manual add via `POST /mesh/{topic}/{peer_id}` API |
| `join_topic` | We joined/subscribed to a topic |
| `peer_subscribed` | Peer subscribed to a topic we're in |
| `heartbeat` | Periodic mesh maintenance (mesh too small, need outbound peers, etc.) |

```
MESH: We are sending GRAFT to peer (reason: heartbeat) | peer=16Uiu2HAm... | topic=...
MESH: We are sending GRAFT to peer (reason: peer_subscribed) | peer=16Uiu2HAm... | topic=...
```

### When We PRUNE Peer (we remove peer from our mesh)

| Reason | Description |
|--------|-------------|
| `manual` | Manual remove via `DELETE /mesh/{topic}/{peer_id}` API |
| `leave_topic` | We left/unsubscribed from a topic |
| `negative_score` | Peer has negative gossipsub score |
| `mesh_high` | Mesh has too many peers (above mesh_n_high) |
| `heartbeat` | Periodic mesh maintenance |
| `explicit_peer` | Rejecting graft from explicit/direct peer |
| `backoff` | Peer is in backoff period |

```
MESH: We are sending PRUNE to peer (reason: negative_score) | peer=16Uiu2HAm... | topic=... | score=-5.0
MESH: Will PRUNE peer (reason: mesh_high) | peer=16Uiu2HAm... | topic=...
```

### Example Log Output

```
[2025-11-30T14:38:11.218+01:00]  INFO libp2p_gossipsub::behaviour: MESH: Received GRAFT from peer (peer wants to add us to their mesh) peer=16Uiu2HAm65MRrXG... topic=/eth2/a4e6abeb/beacon_block/ssz_snappy
[2025-11-30T14:38:11.219+01:00]  INFO libp2p_gossipsub::behaviour: MESH: We added peer to our mesh (accepted peer's GRAFT) peer=16Uiu2HAm65MRrXG... topic=/eth2/a4e6abeb/beacon_block/ssz_snappy
[2025-11-30T14:38:12.500+01:00]  INFO libp2p_gossipsub::behaviour: MESH: We are sending GRAFT to peer (reason: heartbeat mesh maintenance) peer=16Uiu2HAmVgapLCf... topic=/eth2/a4e6abeb/beacon_block/ssz_snappy
[2025-11-30T14:38:15.100+01:00]  INFO libp2p_gossipsub::behaviour: MESH: Received PRUNE from peer (peer removed us from their mesh) peer=16Uiu2HAmRLFGgxh... topic=/eth2/a4e6abeb/beacon_block/ssz_snappy backoff_secs=Some(60)
```

---

## Notes

- All APIs are available on the HTTP API port (default: `5052`)
- **ENR format:** Base64-encoded Ethereum Node Record starting with `enr:-`
- **Multiaddr format:** libp2p multiaddr (e.g., `/ip4/192.168.1.100/tcp/9000/p2p/16Uiu2HAk...`)
- **Peer ID format:** Base58-encoded libp2p peer ID (e.g., `16Uiu2HAk...`)
- **Trusted peers** are automatically reconnected if disconnected
- **Peers added via `POST /peers`** are not automatically reconnected (one-time connection)
- **Permanent bans** persist until manually unbanned via `DELETE /peers/{peer_id}/ban`
- **Temporary bans** from peer scoring auto-unban after ~30 minutes
- **`--ban-peers-file`** loads peer IDs from a file at startup and adds them as permanent bans (visible in `GET /peers/banned`)
- **Hybrid Peer Selection:** When adding peers to the gossipsub mesh, 70% are selected from highest scoring peers and 30% are randomly selected. This balances mesh quality with decentralization.
- **New Peers:** New peers start with score 0 (neutral) and won't be immediately kicked. They can still be selected in the random 30% of hybrid selection.
