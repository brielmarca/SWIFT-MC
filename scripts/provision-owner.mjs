#!/usr/bin/env node
/* global console, process */
/**
 * Controlled first/initial OWNER provisioning (operational use only).
 * - Requires direct DB access (DIRECT_DATABASE_URL). Never run via app/public endpoint.
 * - Binds to immutable Discord provider subject (snowflake ID), not email/display name.
 * - Fails if any OWNER exists or pending/claimed OWNER claim exists (no duplicate bootstrap).
 * - Does not create passwords, sessions, or MFA bypass. Claimed user must complete MFA before admin access.
 *
 * Usage:
 *   DIRECT_DATABASE_URL=postgresql://... node scripts/provision-owner.mjs <discordSubject> [--note "authorized by ..."]
 */
import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

function usageAndExit(msg) {
  if (msg) console.error(msg);
  console.error("Usage: DIRECT_DATABASE_URL=... node scripts/provision-owner.mjs <discordSubject> [--note \"...\"]");
  process.exit(2);
}

const args = process.argv.slice(2);
const discordSubject = args.find((a) => !a.startsWith("--"));
if (!discordSubject || !/^\d{5,32}$/.test(discordSubject)) usageAndExit("discordSubject must be a Discord snowflake ID (immutable provider subject).");
const noteIdx = args.indexOf("--note");
const note = noteIdx >= 0 ? (args[noteIdx + 1] || "").slice(0, 255) : null;

const connectionString = process.env.DIRECT_DATABASE_URL;
if (!connectionString) usageAndExit("DIRECT_DATABASE_URL is required (direct PostgreSQL, never Hyperdrive/pooler for migrations/control ops).");

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString, max: 1, connectionTimeoutMillis: 5000 }) });

try {
  const result = await prisma.$transaction(async (tx) => {
    const ownerCount = await tx.user.count({ where: { role: "OWNER" } });
    if (ownerCount > 0) throw new Error("OWNER_ALREADY_EXISTS: refusing to create duplicate OWNER/bootstrap.");
    const existingOwnerClaim = await tx.provisionedAdmin.findFirst({ where: { targetRole: "OWNER" } });
    if (existingOwnerClaim) throw new Error("OWNER_CLAIM_ALREADY_EXISTS: refusing duplicate OWNER provisioning claim.");
    const existingSubject = await tx.provisionedAdmin.findUnique({ where: { discordSubject } });
    if (existingSubject) throw new Error("SUBJECT_ALREADY_PROVISIONED: claim for this Discord subject already exists.");
    const created = await tx.provisionedAdmin.create({
      data: {
        discordSubject,
        targetRole: "OWNER",
        note,
      },
      select: { id: true, discordSubject: true, targetRole: true, createdAt: true },
    });
    try {
      await tx.authAuditEvent.create({
        data: {
          eventType: "ADMIN_PROVISIONED",
          outcome: "success",
          requestId: `operator:${randomUUID()}`,
          actorUserId: null,
          subjectUserId: null,
          metadata: { reason: "PROVISIONED_ADMIN_CREATED" },
        },
      });
    } catch { /* audit table/shape may differ in older states; claim is the controlled source */ }
    return created;
  });
  console.log(JSON.stringify({ ok: true, provisioned: result, next: [
    "Authorized Discord user must authenticate with the exact provisioned subject.",
    "Claim is one-time/atomic and DB-guarded; no admin access before MFA confirmation.",
    "User must configure and confirm TOTP MFA in /admin/security, then elevate via /admin/login.",
  ] }, null, 2));
} catch (err) {
  console.error(JSON.stringify({ ok: false, error: err instanceof Error ? err.message : String(err) }));
  process.exit(1);
} finally {
  await prisma.$disconnect();
}
