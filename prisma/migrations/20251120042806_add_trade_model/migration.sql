-- CreateTable
CREATE TABLE "Trade" (
    "id" TEXT NOT NULL,
    "trade_number" INTEGER NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL,
    "trigger_category" TEXT NOT NULL,
    "trigger_type" TEXT NOT NULL,
    "block_number" INTEGER NOT NULL,
    "initial_reserves_rlb" DECIMAL(20,8) NOT NULL,
    "trade_amount_rlb" DECIMAL(20,8) NOT NULL,
    "api_call_duration_ms" DECIMAL(10,2),
    "opponent" BOOLEAN NOT NULL DEFAULT false,
    "priority_gwei" DECIMAL(10,3),
    "opponent_trades_count" INTEGER,
    "opponent_time_gap_ms" DECIMAL(10,2),
    "trade_logs" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "win" BOOLEAN,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Trade_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Trade_trade_number_key" ON "Trade"("trade_number");

-- CreateIndex
CREATE INDEX "Trade_trade_number_idx" ON "Trade"("trade_number");

-- CreateIndex
CREATE INDEX "Trade_timestamp_idx" ON "Trade"("timestamp");

-- CreateIndex
CREATE INDEX "Trade_trigger_category_idx" ON "Trade"("trigger_category");

-- CreateIndex
CREATE INDEX "Trade_trigger_type_idx" ON "Trade"("trigger_type");

-- CreateIndex
CREATE INDEX "Trade_block_number_idx" ON "Trade"("block_number");

-- CreateIndex
CREATE INDEX "Trade_opponent_idx" ON "Trade"("opponent");

-- CreateIndex
CREATE INDEX "Trade_win_idx" ON "Trade"("win");
