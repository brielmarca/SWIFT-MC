import "server-only";
import { createHash, timingSafeEqual } from "node:crypto";
import type { AuthBindings } from "@/lib/auth-infrastructure/bindings";

export type BridgeBindings = Pick<AuthBindings, "AUTH_HYPERDRIVE"> & {
  MINECRAFT_BRIDGE_SECRET?: string;
  MINECRAFT_BRIDGE_SERVER_ID?: string;
  MINECRAFT_BRIDGE_ALLOWED_SERVER_IDS?: string;
  APP_URL?: string;
};

export class BridgeAuthError extends Error {
  constructor(public readonly status: 401 | 403 | 422, public readonly code: string, message = "Unauthorized") {
    super(message);
    this.name = "BridgeAuthError";
  }
}

function digest(value: string): Buffer {
  return createHash("sha256").update(value, "utf8").digest();
}

export function verifyBridgeSecret(header: string | null, secret: string | undefined): boolean {
  if (!header?.startsWith("Bearer ") || !secret || secret.length < 32) return false;
  const token = header.slice(7);
  const a = digest(token);
  const b = digest(secret);
  try {
    return timingSafeEqual(a, b) && token === secret;
  } catch {
    return false;
  }
}

export function allowedServerIds(bindings: BridgeBindings): Set<string> | null {
  const raw = bindings.MINECRAFT_BRIDGE_ALLOWED_SERVER_IDS?.trim();
  if (!raw) return null;
  const ids = raw.split(",").map(s => s.trim()).filter(Boolean);
  return ids.length ? new Set(ids) : null;
}

export function verifyBridgeRequest(headers: Headers, bindings: BridgeBindings): { serverId: string } {
  if (!verifyBridgeSecret(headers.get("authorization"), bindings.MINECRAFT_BRIDGE_SECRET)) {
    throw new BridgeAuthError(401, "UNAUTHORIZED");
  }
  const expected = bindings.MINECRAFT_BRIDGE_SERVER_ID?.trim();
  const serverId = headers.get("x-swift-server")?.trim() ?? "";
  if (!expected || !serverId || serverId !== expected) {
    throw new BridgeAuthError(403, "WRONG_SERVER");
  }
  const allow = allowedServerIds(bindings);
  if (allow && !allow.has(serverId)) throw new BridgeAuthError(403, "WRONG_SERVER");
  if (!/^[A-Za-z0-9_.:-]{1,64}$/.test(serverId)) throw new BridgeAuthError(422, "INVALID_SERVER");
  return { serverId };
}

export function json(data: unknown, status = 200): Response {
  return Response.json(data, {
    status,
    headers: {
      "Cache-Control": "no-store",
      "Content-Type": "application/json; charset=utf-8",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "no-referrer",
    },
  });
}

export function bridgeError(error: unknown): Response {
  if (error instanceof BridgeAuthError) return json({ error: error.code }, error.status);
  if (error instanceof Error && error.name === "ValueError") return json({ error: error.message.slice(0, 180) }, 422);
  if (error && typeof error === "object" && "code" in error && (error as { code: string }).code === "VALIDATION") {
    return json({ error: (error as { message?: string }).message ?? "invalid_request" }, 422);
  }
  console.error("bridge-error", error);
  return json({ error: "internal_error" }, 500);
}

export async function readJson(request: Request, maxBytes = 16_384): Promise<unknown> {
  const text = await request.text();
  if (new TextEncoder().encode(text).byteLength > maxBytes) throw new BridgeAuthError(422, "BODY_TOO_LARGE");
  try { return JSON.parse(text); } catch { throw new BridgeAuthError(422, "INVALID_JSON"); }
}
