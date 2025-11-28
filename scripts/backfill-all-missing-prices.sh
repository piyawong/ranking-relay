#!/bin/bash

# Script to backfill all missing RLB prices
# Triggers the backfill API endpoint repeatedly until all prices are updated

echo "=== Backfilling All Missing RLB Prices ==="
echo ""

# Get initial status
INITIAL_STATUS=$(curl -s http://localhost:3000/api/balance/backfill)
MISSING=$(echo "$INITIAL_STATUS" | jq -r '.data.snapshots.withoutPrice')

echo "Total snapshots without price: $MISSING"
echo ""

if [ "$MISSING" -eq 0 ]; then
    echo "✓ All snapshots already have prices!"
    exit 0
fi

# Calculate how many batches needed (50 per batch max)
BATCH_COUNT=$(( ($MISSING + 49) / 50 ))
echo "Processing in ~$BATCH_COUNT batches (50 snapshots per batch)"
echo ""

BATCH_NUM=1
TOTAL_UPDATED=0

while true; do
    echo "Batch $BATCH_NUM: Triggering backfill..."

    # Trigger backfill with max limit
    RESULT=$(curl -s -X POST "http://localhost:3000/api/balance/backfill?limit=50")

    UPDATED=$(echo "$RESULT" | jq -r '.data.updated')
    SUCCESS=$(echo "$RESULT" | jq -r '.success')

    if [ "$SUCCESS" != "true" ]; then
        echo "✗ Error: $(echo "$RESULT" | jq -r '.error')"
        exit 1
    fi

    TOTAL_UPDATED=$((TOTAL_UPDATED + UPDATED))

    echo "  Updated: $UPDATED snapshots (Total: $TOTAL_UPDATED)"

    # Check if we're done
    if [ "$UPDATED" -eq 0 ]; then
        echo ""
        echo "✓ Backfill complete! All snapshots have been updated."
        break
    fi

    BATCH_NUM=$((BATCH_NUM + 1))

    # Small delay to avoid overwhelming the API
    sleep 1
done

# Get final status
echo ""
echo "=== Final Status ==="
FINAL_STATUS=$(curl -s http://localhost:3000/api/balance/backfill)
echo "$FINAL_STATUS" | jq '{
    total: .data.snapshots.total,
    withoutPrice: .data.snapshots.withoutPrice,
    coverage: .data.snapshots.withoutPricePercent,
    rateLimit: .data.rateLimit
}'

echo ""
echo "✓ Script completed successfully"
