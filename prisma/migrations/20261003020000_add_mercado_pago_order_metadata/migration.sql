-- AlterTable
ALTER TABLE "Payment"
ADD COLUMN "providerOrderId" TEXT,
ADD COLUMN "providerIdempotencyKey" TEXT,
ADD COLUMN "checkoutUrl" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Payment_providerOrderId_key" ON "Payment"("providerOrderId");
CREATE UNIQUE INDEX "Payment_providerIdempotencyKey_key" ON "Payment"("providerIdempotencyKey");
