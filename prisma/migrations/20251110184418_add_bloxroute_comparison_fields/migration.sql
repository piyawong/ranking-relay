-- AlterTable
ALTER TABLE "Block" ADD COLUMN     "is_win_bloxroute" BOOLEAN,
ADD COLUMN     "time_difference_ms" INTEGER;

-- CreateIndex
CREATE INDEX "Block_is_win_bloxroute_idx" ON "Block"("is_win_bloxroute");
