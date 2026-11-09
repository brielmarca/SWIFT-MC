import "server-only";
import type { PrismaClient } from "@prisma/client";
import { MINECRAFT_NAMESPACE, normalizeUuid } from "./vip";

export type LinkedMinecraftIdentity = { userId: string; subject: string; lastKnownUsername: string | null };

export async function getLinkedMinecraftIdentityForUser(db: PrismaClient, userId: string): Promise<LinkedMinecraftIdentity | null> {
  const identity = await db.minecraftIdentity.findFirst({ where: { userId, namespace: MINECRAFT_NAMESPACE } });
  if (!identity) return null;
  const subject = normalizeUuid(identity.subject);
  if (!subject) return null; // fail closed; malformed identity must not become a delivery target
  return { userId: identity.userId, subject, lastKnownUsername: identity.lastKnownUsername };
}

// Historical order label only. Delivery targets must come from authoritative linked identity/entitlement UUID.
export function orderIdentityLabel(identity: LinkedMinecraftIdentity): string {
  return (identity.lastKnownUsername ?? identity.subject).slice(0, 64);
}

export class MinecraftLinkRequiredError extends Error {
  constructor() { super("A verified linked Minecraft identity is required."); this.name = "MinecraftLinkRequiredError"; }
}
