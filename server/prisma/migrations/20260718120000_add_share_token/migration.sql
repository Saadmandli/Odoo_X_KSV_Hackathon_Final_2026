-- AlterTable
ALTER TABLE "rides" ADD COLUMN     "shareToken" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "rides_shareToken_key" ON "rides"("shareToken");
