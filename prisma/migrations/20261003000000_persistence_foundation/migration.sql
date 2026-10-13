-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('PENDING_PAYMENT', 'PAID', 'FULFILLED', 'PAYMENT_FAILED', 'EXPIRED', 'REFUNDED', 'REVIEW_REQUIRED');

-- CreateEnum
CREATE TYPE "PaymentProvider" AS ENUM ('MERCADO_PAGO');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('CREATED', 'PENDING', 'APPROVED', 'REJECTED', 'CANCELLED', 'REFUNDED', 'CHARGED_BACK', 'REVIEW_REQUIRED');

-- CreateEnum
CREATE TYPE "PaymentEventStatus" AS ENUM ('RECEIVED', 'PROCESSING', 'PROCESSED', 'RETRY_PENDING', 'DEAD_LETTER', 'IGNORED');

-- CreateEnum
CREATE TYPE "FulfillmentStatus" AS ENUM ('PENDING', 'PROCESSING', 'SUCCEEDED', 'RETRY_PENDING', 'FAILED');

-- CreateTable
CREATE TABLE "Order" (
    "id" TEXT NOT NULL,
    "publicToken" TEXT NOT NULL,
    "orderNumber" TEXT NOT NULL,
    "status" "OrderStatus" NOT NULL DEFAULT 'PENDING_PAYMENT',
    "rankSlug" TEXT NOT NULL,
    "rankName" TEXT NOT NULL,
    "minecraftUsername" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'BRL',
    "subtotalCents" INTEGER NOT NULL,
    "discountCents" INTEGER NOT NULL DEFAULT 0,
    "totalCents" INTEGER NOT NULL,
    "checkoutIdempotencyKey" TEXT NOT NULL,
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,
    "paidAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Order_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "Order_subtotalCents_nonnegative" CHECK ("subtotalCents" >= 0),
    CONSTRAINT "Order_discountCents_valid" CHECK ("discountCents" >= 0 AND "discountCents" <= "subtotalCents"),
    CONSTRAINT "Order_totalCents_positive" CHECK ("totalCents" > 0),
    CONSTRAINT "Order_totalCents_matches" CHECK ("totalCents" = "subtotalCents" - "discountCents"),
    CONSTRAINT "Order_currency_brl" CHECK ("currency" = 'BRL')
);

-- CreateTable
CREATE TABLE "Payment" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "provider" "PaymentProvider" NOT NULL DEFAULT 'MERCADO_PAGO',
    "status" "PaymentStatus" NOT NULL DEFAULT 'CREATED',
    "preferenceId" TEXT,
    "providerPaymentId" TEXT,
    "providerStatus" TEXT,
    "providerStatusDetail" TEXT,
    "paymentMethod" TEXT,
    "amountCents" INTEGER,
    "currency" TEXT,
    "approvedAt" TIMESTAMPTZ(3),
    "lastSyncedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "Payment_amountCents_nonnegative" CHECK ("amountCents" IS NULL OR "amountCents" >= 0)
);

-- CreateTable
CREATE TABLE "PaymentEvent" (
    "id" TEXT NOT NULL,
    "provider" "PaymentProvider" NOT NULL DEFAULT 'MERCADO_PAGO',
    "deduplicationKey" TEXT NOT NULL,
    "providerEventId" TEXT,
    "providerResourceId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "signatureValid" BOOLEAN NOT NULL,
    "payload" JSONB NOT NULL,
    "status" "PaymentEventStatus" NOT NULL DEFAULT 'RECEIVED',
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "nextAttemptAt" TIMESTAMPTZ(3),
    "processedAt" TIMESTAMPTZ(3),
    "lastErrorCode" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "PaymentEvent_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "PaymentEvent_attemptCount_nonnegative" CHECK ("attemptCount" >= 0)
);

-- CreateTable
CREATE TABLE "Fulfillment" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "status" "FulfillmentStatus" NOT NULL DEFAULT 'PENDING',
    "rankSlug" TEXT NOT NULL,
    "minecraftUsername" TEXT NOT NULL,
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "nextAttemptAt" TIMESTAMPTZ(3),
    "lockedAt" TIMESTAMPTZ(3),
    "lastErrorCode" TEXT,
    "providerReference" TEXT,
    "fulfilledAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Fulfillment_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "Fulfillment_attemptCount_nonnegative" CHECK ("attemptCount" >= 0)
);

-- CreateIndex
CREATE UNIQUE INDEX "Order_publicToken_key" ON "Order"("publicToken");
CREATE UNIQUE INDEX "Order_orderNumber_key" ON "Order"("orderNumber");
CREATE UNIQUE INDEX "Order_checkoutIdempotencyKey_key" ON "Order"("checkoutIdempotencyKey");
CREATE INDEX "Order_status_createdAt_idx" ON "Order"("status", "createdAt");
CREATE INDEX "Order_minecraftUsername_idx" ON "Order"("minecraftUsername");
CREATE UNIQUE INDEX "Payment_preferenceId_key" ON "Payment"("preferenceId");
CREATE UNIQUE INDEX "Payment_providerPaymentId_key" ON "Payment"("providerPaymentId");
CREATE INDEX "Payment_orderId_createdAt_idx" ON "Payment"("orderId", "createdAt");
CREATE UNIQUE INDEX "PaymentEvent_deduplicationKey_key" ON "PaymentEvent"("deduplicationKey");
CREATE INDEX "PaymentEvent_status_nextAttemptAt_idx" ON "PaymentEvent"("status", "nextAttemptAt");
CREATE INDEX "PaymentEvent_providerResourceId_idx" ON "PaymentEvent"("providerResourceId");
CREATE UNIQUE INDEX "Fulfillment_orderId_key" ON "Fulfillment"("orderId");
CREATE INDEX "Fulfillment_status_nextAttemptAt_idx" ON "Fulfillment"("status", "nextAttemptAt");

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Fulfillment" ADD CONSTRAINT "Fulfillment_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
