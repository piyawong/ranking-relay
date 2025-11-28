#!/bin/bash
# Auto-clear high-diff balance snapshots
# Keeps deleting until no more high-diffs are found

BASE_URL="${1:-http://148.251.66.154:3000}"
MAX_ITERATIONS=100
DRY_RUN="${2:-false}"

echo "=========================================="
echo "High-Diff Auto-Clear Script"
echo "Server: $BASE_URL"
echo "Dry Run: $DRY_RUN"
echo "=========================================="

iteration=0
total_deleted=0

while [ $iteration -lt $MAX_ITERATIONS ]; do
    iteration=$((iteration + 1))

    # Fetch current high-diff snapshots
    response=$(curl -s "$BASE_URL/api/balance/high-diff?limit=10")

    # Check if successful
    success=$(echo "$response" | jq -r '.success')
    if [ "$success" != "true" ]; then
        echo "Error fetching high-diff: $(echo "$response" | jq -r '.error')"
        break
    fi

    # Get count and IDs
    count=$(echo "$response" | jq -r '.data.count')

    if [ "$count" -eq 0 ] || [ "$count" == "null" ]; then
        echo ""
        echo "✅ No more high-diff snapshots found!"
        break
    fi

    # Get first snapshot details
    first_id=$(echo "$response" | jq -r '.data.snapshotIds[0]')
    first_timestamp=$(echo "$response" | jq -r '.data.details[0].timestamp')
    first_reason=$(echo "$response" | jq -r '.data.details[0].reason')

    echo ""
    echo "Iteration $iteration: Found $count high-diff(s)"
    echo "  → Deleting: $first_id"
    echo "    Timestamp: $first_timestamp"
    echo "    Reason: $first_reason"

    if [ "$DRY_RUN" == "true" ]; then
        echo "    [DRY RUN - not actually deleting]"
        # In dry run, we still need to break to avoid infinite loop
        # Just show all that would be deleted
        echo ""
        echo "All snapshots that would be deleted:"
        echo "$response" | jq -r '.data.details[] | "  - \(.id) (\(.timestamp)): \(.reason)"'
        break
    fi

    # Delete the snapshot
    delete_response=$(curl -s -X DELETE "$BASE_URL/api/balance/high-diff/delete?snapshotId=$first_id")
    delete_success=$(echo "$delete_response" | jq -r '.success')

    if [ "$delete_success" == "true" ]; then
        echo "    ✓ Deleted successfully"
        total_deleted=$((total_deleted + 1))
    else
        echo "    ✗ Delete failed: $(echo "$delete_response" | jq -r '.error')"
        break
    fi

    # Small delay to avoid hammering the server
    sleep 0.2
done

echo ""
echo "=========================================="
echo "Summary:"
echo "  Iterations: $iteration"
echo "  Total Deleted: $total_deleted"
if [ $iteration -ge $MAX_ITERATIONS ]; then
    echo "  ⚠️  Reached max iterations limit ($MAX_ITERATIONS)"
fi
echo "=========================================="
