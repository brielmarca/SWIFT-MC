import "server-only";
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

export const DISCORD_PROVIDER = "DISCORD" as const;
const AUTHORIZE_URL = "https://discord.com/oauth2/authorize";
const TOKEN_URL = "https://discord.com/api/oauth2/token";
const USER_URL = "https://discord.com/api/users/@me";
const SCOPE = "identify";

export type DiscordEnv = { DISCORD_CLIENT_ID?: string; DISCORD_CLIENT_SECRET?: string; DISCORD_REDIRECT_URI?: string; AUTH_ENCRYPTION_KEY?: string; APP_URL?: string };

export function discordConfigured(env: DiscordEnv): env is Required<Pick<DiscordEnv, "DISCORD_CLIENT_ID" | "DISCORD_CLIENT_SECRET" | "DISCORD_REDIRECT_URI" | "AUTH_ENCRYPTION_KEY">> & DiscordEnv {
  return Boolean(env.DISCORD_CLIENT_ID && env.DISCORD_CLIENT_SECRET && env.DISCORD_REDIRECT_URI && env.AUTH_ENCRYPTION_KEY);
}

export function pkceVerifier(): string { return randomBytes(32).toString("base64url"); }
export function pkceChallenge(verifier: string): string { return createHash("sha256").update(verifier).digest("base64url"); }

function keyFrom(env: DiscordEnv): Buffer {
  const raw = env.AUTH_ENCRYPTION_KEY || "";
  if (/^[a-f0-9]{64}$/i.test(raw)) return Buffer.from(raw, "hex");
  try { const b = Buffer.from(raw, "base64"); if (b.length === 32) return b; } catch { /* try next encoding */ }
  try { const b = Buffer.from(raw, "base64url"); if (b.length === 32) return b; } catch { /* invalid key */ }
  throw new Error("AUTH_ENCRYPTION_KEY must be 32 bytes");
}

export function encryptSecret(env: DiscordEnv, plaintext: string): string {
  const key = keyFrom(env);
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1.${iv.toString("base64url")}.${tag.toString("base64url")}.${encrypted.toString("base64url")}`;
}

export function decryptSecret(env: DiscordEnv, ciphertext: string): string {
  const [v, ivs, tags, datas] = String(ciphertext || "").split(".");
  if (v !== "v1" || !ivs || !tags || !datas) throw new Error("Invalid secret ciphertext");
  const key = keyFrom(env);
  const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(ivs, "base64url"));
  decipher.setAuthTag(Buffer.from(tags, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(datas, "base64url")), decipher.final()]).toString("utf8");
}

export function buildDiscordAuthorizeUrl(env: Required<Pick<DiscordEnv, "DISCORD_CLIENT_ID" | "DISCORD_REDIRECT_URI">>, params: { state: string; codeChallenge: string }): string {
  const url = new URL(AUTHORIZE_URL);
  url.searchParams.set("client_id", env.DISCORD_CLIENT_ID);
  url.searchParams.set("redirect_uri", env.DISCORD_REDIRECT_URI);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", SCOPE);
  url.searchParams.set("state", params.state);
  url.searchParams.set("code_challenge", params.codeChallenge);
  url.searchParams.set("code_challenge_method", "S256");
  url.searchParams.set("prompt", "consent");
  return url.toString();
}

export async function exchangeDiscordCode(env: Required<Pick<DiscordEnv, "DISCORD_CLIENT_ID" | "DISCORD_CLIENT_SECRET" | "DISCORD_REDIRECT_URI">>, params: { code: string; codeVerifier: string }): Promise<{ access_token: string; token_type: string }> {
  const body = new URLSearchParams({
    client_id: env.DISCORD_CLIENT_ID,
    client_secret: env.DISCORD_CLIENT_SECRET,
    grant_type: "authorization_code",
    code: params.code,
    redirect_uri: env.DISCORD_REDIRECT_URI,
    code_verifier: params.codeVerifier,
  });
  const res = await fetch(TOKEN_URL, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body, cache: "no-store" });
  if (!res.ok) throw new Error("DISCORD_TOKEN_EXCHANGE_FAILED");
  return res.json() as Promise<{ access_token: string; token_type: string }>;
}

export async function fetchDiscordUser(accessToken: string): Promise<{ id: string; username?: string; global_name?: string }> {
  const res = await fetch(USER_URL, { headers: { Authorization: `Bearer ${accessToken}` }, cache: "no-store" });
  if (!res.ok) throw new Error("DISCORD_USER_FETCH_FAILED");
  const data = await res.json() as { id?: unknown; username?: unknown; global_name?: unknown };
  if (typeof data.id !== "string" || !/^\d+$/.test(data.id)) throw new Error("DISCORD_USER_INVALID");
  return { id: data.id, username: typeof data.username === "string" ? data.username : undefined, global_name: typeof data.global_name === "string" ? data.global_name : undefined };
}
