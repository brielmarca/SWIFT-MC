-- Add userId to Order for order ownership and account history
-- Review and exercise on PostgreSQL staging before deployment.
BEGIN;

ALTER TABLE "Order" ADD COLUMN "userId" VARCHAR(255);

ALTER TABLE "Order" ADD CONSTRAINT "Order_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

CREATE INDEX "Order_userId_idx" ON "Order"("userId");
CREATE INDEX "Order_userId_createdAt_idx" ON "Order"("userId", "createdAt");

COMMIT;
