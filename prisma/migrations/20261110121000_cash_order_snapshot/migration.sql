-- Constant default on PG17 is metadata-only; existing VIP orders remain unchanged.
-- Rollback: retain the additive field when rolling back the application.
ALTER TABLE "Order" ADD COLUMN "cashAmount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Order" ADD CONSTRAINT "Order_cashAmount_range" CHECK ("cashAmount" BETWEEN 0 AND 100000000);
