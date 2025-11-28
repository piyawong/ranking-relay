#!/bin/bash

echo "=== Backfilling ALL Execution Block Numbers ==="

REMAINING=$(docker compose exec -T postgres psql -U relay_user -d relay_db -c "SELECT COUNT(*) FROM \"Block\" WHERE execution_block_number IS NULL;" | grep -oP '\d+' | head -1)

echo "Total slots to backfill: $REMAINING"

BATCH=0
while [ "$REMAINING" -gt 0 ]; do
    BATCH=$((BATCH + 1))
    echo ""
    echo "=== Batch $BATCH ==="

    npx tsx scripts/backfill-execution-blocks.ts 2>&1 | grep -E "Found|Updated|Failed|Complete"

    REMAINING=$(docker compose exec -T postgres psql -U relay_user -d relay_db -c "SELECT COUNT(*) FROM \"Block\" WHERE execution_block_number IS NULL;" | grep -oP '\d+' | head -1)

    echo "Remaining: $REMAINING"

    if [ "$REMAINING" -eq 0 ]; then
        break
    fi

    # Small delay between batches
    sleep 1
done

echo ""
echo "✓ All slots backfilled!"
