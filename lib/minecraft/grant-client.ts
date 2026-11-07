import "server-only";

const MAX_RESPONSE_BYTES = 64 * 1024;
const REQUEST_TIMEOUT_MS = 10_000;

const FULFILLMENT_ID_PATTERN = /^[A-Za-z0-9_-]{1,255}$/;
const USERNAME_PATTERN = /^[\p{L}\p{N}_ .#-]+$/u;
const RANK_SLUG_PATTERN = /^[a-z0-9_-]{1,32}$/;

export type MinecraftGrantConfig = {
  baseUrl: string;
  token: string;
};

export type GrantResult =
  | { status: "granted"; reference: string }
  | { status: "already_granted"; reference: string }
  | { status: "not_found"; reason: string }
  | { status: "unavailable" };

export function getMinecraftGrantConfig(
  env: Record<string, string | undefined> = process.env,
): MinecraftGrantConfig | null {
  const rawUrl = env.MINECRAFT_FULFILLMENT_URL?.trim();
  const token = env.MINECRAFT_FULFILLMENT_TOKEN?.trim();

  if (!rawUrl || !token) return null;

  try {
    const url = new URL(rawUrl);
    if (url.protocol !== "https:") return null;
    if (url.username || url.password) return null;
    url.pathname = `${url.pathname.replace(/\/+$/, "")}/`;
    return { baseUrl: url.toString(), token };
  } catch {
    return null;
  }
}

async function boundedJsonResponse(response: Response): Promise<unknown> {
  if (!response.ok) return { status: "unavailable" as const };
  const responseBody = await response.text();
  if (new TextEncoder().encode(responseBody).byteLength > MAX_RESPONSE_BYTES) {
    return { status: "unavailable" as const };
  }
  try {
    return JSON.parse(responseBody);
  } catch {
    return { status: "unavailable" as const };
  }
}

function normalizeGrantResponse(body: unknown): GrantResult {
  if (!body || typeof body !== "object") return { status: "unavailable" };
  const obj = body as Record<string, unknown>;
  const status = obj.status;

  if (status === "granted") {
    const reference =
      typeof obj.reference === "string" && obj.reference.length > 0
        ? obj.reference
        : "";
    return { status: "granted", reference };
  }

  if (status === "already_granted") {
    const reference =
      typeof obj.reference === "string" && obj.reference.length > 0
        ? obj.reference
        : "";
    return { status: "already_granted", reference };
  }

  if (status === "not_found") {
    const reason =
      typeof obj.reason === "string" && obj.reason.length > 0
        ? obj.reason
        : "player not found";
    return { status: "not_found", reason };
  }

  return { status: "unavailable" };
}

export class MinecraftGrantUnavailableError extends Error {
  constructor() {
    super("Minecraft fulfillment is unavailable.");
    this.name = "MinecraftGrantUnavailableError";
  }
}

export function createMinecraftGrantClient(
  config: MinecraftGrantConfig,
  request: typeof fetch = fetch,
) {
  async function post(
    path: string,
    body: unknown,
    idempotencyKey: string,
  ): Promise<GrantResult> {
    if (!/^\/[A-Za-z0-9_-]+(\/[A-Za-z0-9_-]+)*$/.test(path)) {
      return { status: "unavailable" };
    }

    let response: Response;
    try {
      response = await request(`${config.baseUrl}${path}`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${config.token}`,
          "Content-Type": "application/json",
          "Idempotency-Key": idempotencyKey,
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
    } catch {
      return { status: "unavailable" };
    }

    const parsed = await boundedJsonResponse(response);
    return normalizeGrantResponse(parsed);
  }

  return {
    async grantRank(
      fulfillmentId: string,
      username: string,
      rankSlug: string,
    ): Promise<GrantResult> {
      if (
        !FULFILLMENT_ID_PATTERN.test(fulfillmentId) ||
        !USERNAME_PATTERN.test(username) ||
        !RANK_SLUG_PATTERN.test(rankSlug)
      ) {
        return { status: "unavailable" };
      }
      return post("/v1/grant/rank", { fulfillmentId, username, rankSlug }, fulfillmentId);
    },

    async grantCoins(
      fulfillmentId: string,
      username: string,
      amount: number,
    ): Promise<GrantResult> {
      if (
        !FULFILLMENT_ID_PATTERN.test(fulfillmentId) ||
        !USERNAME_PATTERN.test(username) ||
        !Number.isInteger(amount) ||
        amount <= 0
      ) {
        return { status: "unavailable" };
      }
      return post("/v1/grant/coins", { fulfillmentId, username, amount }, fulfillmentId);
    },
  };
}
