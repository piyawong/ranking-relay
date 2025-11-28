#!/bin/bash
# Smart purge - deletes ALL snapshots in anomalous time ranges at once
# Much faster than deleting one at a time

BASE_URL="${1:-http://localhost:3000}"

echo "=========================================="
echo "Smart High-Diff Purge"
echo "Server: $BASE_URL"
echo "=========================================="

# Get first high-diff to find the anomalous time range
response=$(curl -s "$BASE_URL/api/balance/high-diff?limit=50")
count=$(echo "$response" | jq -r '.data.count')

if [ "$count" -eq 0 ] || [ "$count" == "null" ]; then
    echo "✅ No high-diff snapshots found!"
    exit 0
fi

echo "Found $count high-diff snapshots"

# Get all the IDs
ids=$(echo "$response" | jq -r '.data.snapshotIds[]')
ids_json=$(echo "$response" | jq -c '.data.snapshotIds')

# Batch delete all at once
echo "Batch deleting $count snapshots..."
delete_response=$(curl -s -X POST "$BASE_URL/api/balance/high-diff/delete" \
    -H "Content-Type: application/json" \
    -d "{\"snapshotIds\": $ids_json}")

deleted_count=$(echo "$delete_response" | jq -r '.data.deletedCount // 0')
echo "Deleted: $deleted_count"

# Keep going until clean
total_deleted=$deleted_count
rounds=1

while true; do
    # Check for more
    response=$(curl -s "$BASE_URL/api/balance/high-diff?limit=50")
    count=$(echo "$response" | jq -r '.data.count')

    if [ "$count" -eq 0 ] || [ "$count" == "null" ]; then
        echo ""
        echo "✅ All clear!"
        break
    fi

    rounds=$((rounds + 1))
    ids_json=$(echo "$response" | jq -c '.data.snapshotIds')

    delete_response=$(curl -s -X POST "$BASE_URL/api/balance/high-diff/delete" \
        -H "Content-Type: application/json" \
        -d "{\"snapshotIds\": $ids_json}")

    deleted_count=$(echo "$delete_response" | jq -r '.data.deletedCount // 0')
    total_deleted=$((total_deleted + deleted_count))

    echo "Round $rounds: Deleted $deleted_count (total: $total_deleted)"
done

echo ""
echo "=========================================="
echo "Summary: Deleted $total_deleted in $rounds rounds"
echo "=========================================="
