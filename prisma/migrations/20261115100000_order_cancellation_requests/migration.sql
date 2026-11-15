-- Durable customer cancellation and refund requests.
-- This table never changes Order/Payment/Fulfillment states or calls providers.
CREATE TABLE "OrderCancellationRequest" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "orderId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "reason" VARCHAR(800),
  "status" VARCHAR(24) NOT NULL DEFAULT 'OPEN',
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "OrderCancellationRequest_orderId_key" UNIQUE ("orderId"),
  CONSTRAINT "OrderCancellationRequest_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT "OrderCancellationRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT "OrderCancellationRequest_status_check" CHECK ("status" IN ('OPEN','IN_REVIEW','CLOSED')),
  CONSTRAINT "OrderCancellationRequest_reason_check" CHECK ("reason" IS NULL OR (length(btrim("reason")) > 0 AND char_length("reason") <= 800))
);
CREATE INDEX "OrderCancellationRequest_status_createdAt_idx" ON "OrderCancellationRequest"("status","createdAt");
CREATE INDEX "OrderCancellationRequest_userId_createdAt_idx" ON "OrderCancellationRequest"("userId","createdAt");
