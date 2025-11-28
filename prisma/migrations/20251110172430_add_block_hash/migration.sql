-- AlterTable
ALTER TABLE "Block" ADD COLUMN     "block_hash" TEXT;

-- CreateIndex
CREATE INDEX "Block_block_hash_idx" ON "Block"("block_hash");
