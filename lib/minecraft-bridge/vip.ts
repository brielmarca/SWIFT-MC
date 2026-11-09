import "server-only";

export const MINECRAFT_NAMESPACE = "java";
export const VIP_RANKS = ["swift", "eclipse", "cosmic", "overdrive"] as const;
export type VipRankSlug = (typeof VIP_RANKS)[number];
export const VIP_ORDER: Record<VipRankSlug, number> = { swift: 1, eclipse: 2, cosmic: 3, overdrive: 4 };
export const VIP_DAYS = 30;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const NICK_RE = /^[A-Za-z0-9_]{3,16}$/;
const CODE_RE = /^[A-Za-z0-9_-]{15,64}$/;

export function isVipRank(value: string): value is VipRankSlug {
  return (VIP_RANKS as readonly string[]).includes(value);
}

export function normalizeUuid(value: string): string | null {
  const trimmed = value.trim();
  if (!UUID_RE.test(trimmed)) return null;
  return trimmed.toLowerCase();
}

export function normalizeNickname(value: string): string | null {
  const trimmed = value.trim();
  if (!NICK_RE.test(trimmed)) return null;
  return trimmed;
}

export function normalizeLinkCode(value: string): string | null {
  const trimmed = value.trim();
  if (!CODE_RE.test(trimmed)) return null;
  return trimmed;
}

export function vipRankFromOrder(order: { rankSlug: string; totalCents?: number }): VipRankSlug | null {
  if (!isVipRank(order.rankSlug)) return null;
  if (order.totalCents !== undefined && (!Number.isSafeInteger(order.totalCents) || order.totalCents <= 0)) return null;
  return order.rankSlug;
}

export function absoluteVipExpiry(now: Date, days = VIP_DAYS): Date {
  return new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
}

export function selectActiveVipSnapshot(entitlements: Array<{ rankSlug: string; expiresAt: Date; status: string }>, now: Date): { rank: VipRankSlug; expiresAt: Date } | null {
  let best: { rank: VipRankSlug; expiresAt: Date; order: number } | null = null;
  for (const e of entitlements) {
    if (e.status !== "ACTIVE") continue;
    if (!(e.expiresAt instanceof Date) || e.expiresAt.getTime() <= now.getTime()) continue;
    if (!isVipRank(e.rankSlug)) continue;
    const order = VIP_ORDER[e.rankSlug];
    if (!best || order > best.order || (order === best.order && e.expiresAt.getTime() > best.expiresAt.getTime())) {
      best = { rank: e.rankSlug, expiresAt: e.expiresAt, order };
    }
  }
  return best ? { rank: best.rank, expiresAt: best.expiresAt } : null;
}
