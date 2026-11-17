-- CreateEnum
CREATE TYPE "VipEntitlementStatus" AS ENUM ('ACTIVE', 'EXPIRED', 'REVOKED');
CREATE TYPE "BridgeDeliveryStatus" AS ENUM ('PENDING', 'SUPERSEDED', 'ACKED', 'CANCELLED_REFUND');

-- CreateTable
CREATE TABLE "MinecraftLinkCode" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "identityId" TEXT,
    "codeHash" VARCHAR(128) NOT NULL,
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,
    "consumedAt" TIMESTAMPTZ(3),
    "consumedUuid" VARCHAR(36),
    "consumedNickname" VARCHAR(16),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MinecraftLinkCode_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "VipEntitlement" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "fulfillmentId" TEXT NOT NULL,
    "rankSlug" VARCHAR(32) NOT NULL,
    "minecraftUuid" VARCHAR(36),
    "minecraftUsername" VARCHAR(64) NOT NULL,
    "startsAt" TIMESTAMPTZ(3) NOT NULL,
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,
    "status" "VipEntitlementStatus" NOT NULL DEFAULT 'ACTIVE',
    "revokedAt" TIMESTAMPTZ(3),
    "revokeReason" VARCHAR(64),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    CONSTRAINT "VipEntitlement_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MinecraftDeliverySequence" (
    "accountId" VARCHAR(191) NOT NULL,
    "nextSeq" BIGINT NOT NULL DEFAULT 1,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    CONSTRAINT "MinecraftDeliverySequence_pkey" PRIMARY KEY ("accountId")
);

CREATE TABLE "BridgeDelivery" (
    "deliveryId" VARCHAR(191) NOT NULL,
    "accountId" VARCHAR(191) NOT NULL,
    "playerUuid" VARCHAR(36) NOT NULL,
    "kind" VARCHAR(16) NOT NULL,
    "action" VARCHAR(16) NOT NULL,
    "vip" VARCHAR(32),
    "cashAmount" INTEGER NOT NULL DEFAULT 0,
    "expiresAt" TIMESTAMPTZ(3),
    "sequence" BIGINT NOT NULL,
    "status" "BridgeDeliveryStatus" NOT NULL DEFAULT 'PENDING',
    "serverId" VARCHAR(64),
    "ackedAt" TIMESTAMPTZ(3),
    "supersededAt" TIMESTAMPTZ(3),
    "orderId" TEXT,
    "entitlementId" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    CONSTRAINT "BridgeDelivery_pkey" PRIMARY KEY ("deliveryId")
);

CREATE UNIQUE INDEX "MinecraftLinkCode_codeHash_key" ON "MinecraftLinkCode"("codeHash");
CREATE INDEX "MinecraftLinkCode_userId_createdAt_idx" ON "MinecraftLinkCode"("userId", "createdAt");
CREATE INDEX "MinecraftLinkCode_expiresAt_idx" ON "MinecraftLinkCode"("expiresAt");

CREATE UNIQUE INDEX "VipEntitlement_orderId_key" ON "VipEntitlement"("orderId");
CREATE UNIQUE INDEX "VipEntitlement_fulfillmentId_key" ON "VipEntitlement"("fulfillmentId");
CREATE INDEX "VipEntitlement_userId_status_expiresAt_idx" ON "VipEntitlement"("userId", "status", "expiresAt");
CREATE INDEX "VipEntitlement_minecraftUuid_status_expiresAt_idx" ON "VipEntitlement"("minecraftUuid", "status", "expiresAt");

CREATE INDEX "BridgeDelivery_status_accountId_sequence_idx" ON "BridgeDelivery"("status", "accountId", "sequence");
CREATE INDEX "BridgeDelivery_orderId_idx" ON "BridgeDelivery"("orderId");
CREATE INDEX "BridgeDelivery_entitlementId_status_idx" ON "BridgeDelivery"("entitlementId", "status");

ALTER TABLE "MinecraftLinkCode" ADD CONSTRAINT "MinecraftLinkCode_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE "MinecraftLinkCode" ADD CONSTRAINT "MinecraftLinkCode_identityId_fkey" FOREIGN KEY ("identityId") REFERENCES "MinecraftIdentity"("id") ON DELETE SET NULL ON UPDATE RESTRICT;
ALTER TABLE "VipEntitlement" ADD CONSTRAINT "VipEntitlement_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE "VipEntitlement" ADD CONSTRAINT "VipEntitlement_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE "VipEntitlement" ADD CONSTRAINT "VipEntitlement_fulfillmentId_fkey" FOREIGN KEY ("fulfillmentId") REFERENCES "Fulfillment"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE "BridgeDelivery" ADD CONSTRAINT "BridgeDelivery_entitlementId_fkey" FOREIGN KEY ("entitlementId") REFERENCES "VipEntitlement"("id") ON DELETE SET NULL ON UPDATE RESTRICT;
