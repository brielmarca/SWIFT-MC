-- AlterTable
ALTER TABLE "Order" ADD COLUMN "rankDuration" TEXT;

UPDATE "Order"
SET "rankDuration" = 'Vitalício'
WHERE "rankSlug" IN ('vip', 'vip-plus', 'mvp');

ALTER TABLE "Order" ALTER COLUMN "rankDuration" SET NOT NULL;
