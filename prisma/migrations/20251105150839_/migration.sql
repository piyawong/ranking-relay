-- CreateTable
CREATE TABLE "Block" (
    "id" TEXT NOT NULL,
    "block_number" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Block_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RelayDetail" (
    "id" TEXT NOT NULL,
    "block_id" TEXT NOT NULL,
    "relay_name" TEXT NOT NULL,
    "latency" DECIMAL(10,2) NOT NULL,
    "loss" DECIMAL(5,2) NOT NULL,
    "arrival_order" INTEGER NOT NULL,
    "ranking_score" DECIMAL(10,2) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RelayDetail_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RelayStatistics" (
    "id" TEXT NOT NULL,
    "relay_name" TEXT NOT NULL,
    "total_blocks" INTEGER NOT NULL DEFAULT 0,
    "avg_latency" DECIMAL(10,2) NOT NULL,
    "avg_loss" DECIMAL(5,2) NOT NULL,
    "first_arrival_count" INTEGER NOT NULL DEFAULT 0,
    "last_updated" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RelayStatistics_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Block_block_number_key" ON "Block"("block_number");

-- CreateIndex
CREATE INDEX "Block_block_number_idx" ON "Block"("block_number");

-- CreateIndex
CREATE INDEX "RelayDetail_block_id_idx" ON "RelayDetail"("block_id");

-- CreateIndex
CREATE INDEX "RelayDetail_relay_name_idx" ON "RelayDetail"("relay_name");

-- CreateIndex
CREATE INDEX "RelayDetail_ranking_score_idx" ON "RelayDetail"("ranking_score");

-- CreateIndex
CREATE UNIQUE INDEX "RelayStatistics_relay_name_key" ON "RelayStatistics"("relay_name");

-- CreateIndex
CREATE INDEX "RelayStatistics_relay_name_idx" ON "RelayStatistics"("relay_name");

-- AddForeignKey
ALTER TABLE "RelayDetail" ADD CONSTRAINT "RelayDetail_block_id_fkey" FOREIGN KEY ("block_id") REFERENCES "Block"("id") ON DELETE CASCADE ON UPDATE CASCADE;
