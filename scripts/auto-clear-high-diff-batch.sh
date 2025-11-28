#!/bin/bash
# Auto-clear high-diff balance snapshots - BATCH VERSION
# Deletes all high-diffs at once, then checks for new ones

BASE_URL="${1:-http://localhost:3000}"
MAX_ROUNDS=1000

echo "=========================================="
echo "High-Diff Auto-Clear (Batch Mode)"
echo "Server: $BASE_URL"
echo "=========================================="

round=0
total_deleted=0

while [ $round -lt $MAX_ROUNDS ]; do
    round=$((round + 1))

    # Fetch ALL current high-diff snapshots (limit 50)
    response=$(curl -s "$BASE_URL/api/balance/high-diff?limit=50")

    success=$(echo "$response" | jq -r '.success')
    if [ "$success" != "true" ]; then
        echo "Error fetching high-diff: $(echo "$response" | jq -r '.error')"
        break
    fi

    count=$(echo "$response" | jq -r '.data.count')

    if [ "$count" -eq 0 ] || [ "$count" == "null" ]; then
        echo ""
        echo "✅ No more high-diff snapshots found!"
        break
    fi

    echo ""
    echo "Round $round: Found $count high-diff(s) - batch deleting..."

    # Get all IDs as JSON array
    ids_json=$(echo "$response" | jq -c '.data.snapshotIds')

    # Batch delete using POST
    delete_response=$(curl -s -X POST "$BASE_URL/api/balance/high-diff/delete" \
        -H "Content-Type: application/json" \
        -d "{\"snapshotIds\": $ids_json}")

    delete_success=$(echo "$delete_response" | jq -r '.success')
    deleted_count=$(echo "$delete_response" | jq -r '.data.deletedCount // 0')

    if [ "$delete_success" == "true" ]; then
        echo "  ✓ Batch deleted $deleted_count snapshots"
        total_deleted=$((total_deleted + deleted_count))
    else
        echo "  ✗ Batch delete failed: $(echo "$delete_response" | jq -r '.error')"
        break
    fi

    # No delay for speed
done

echo ""
echo "=========================================="
echo "Summary:"
echo "  Rounds: $round"
echo "  Total Deleted: $total_deleted"
if [ $round -ge $MAX_ROUNDS ]; then
    echo "  ⚠️  Reached max rounds limit ($MAX_ROUNDS)"
fi
echo "=========================================="
