import "server-only";
import { z } from "zod";
import { getWorkersEnv } from "@/lib/auth-api/get-env";
import { requireSession, requireCsrfToken } from "@/lib/auth/middleware";
import { getPrisma } from "@/lib/prisma";
import { createRateLimiter, rateLimitResponse } from "@/lib/auth-infrastructure/rate-limit";
import { createHash } from "node:crypto";
import { encryptMfaSecret, generateTotpSecret, otpauthUri, verifyTotp } from "@/lib/auth/mfa";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function json(code: string, status: number, message: string, extra: Record<string, unknown> = {}) {
  return Response.json({ error: { code, message }, ...extra }, { status, headers: { "Cache-Control": "private, no-store" } });
}
function key(input: string) { return createHash("sha256").update(`swiftmc:auth:ratelimit:v1\0${input}`).digest("hex"); }

export async function GET(request: Request) {
  const env = await getWorkersEnv();
  const auth = await requireSession(request, env);
  if (auth instanceof Response) return auth;
  if (!env.AUTH_HYPERDRIVE) return json("REQUEST_FAILED", 503, "Indisponível.");
  const prisma = getPrisma();
  const [identity, mfa] = await Promise.all([
    prisma.authIdentity.findFirst({ where: { userId: auth.user.id, provider: "DISCORD" }, select: { id: true } }),
    prisma.mfaCredential.findUnique({ where: { userId: auth.user.id }, select: { enabledAt: true } }),
  ]);
  return Response.json({ discordLinked: !!identity, mfaEnabled: !!mfa, mfaEnabledAt: mfa?.enabledAt ?? null }, { headers: { "Cache-Control": "private, no-store" } });
}

const enableSchema = z.object({ code: z.string().regex(/^\d{6}$/), secret: z.string().min(16).max(128) }).strict();

export async function POST(request: Request) {
  const env = await getWorkersEnv();
  const auth = await requireSession(request, env);
  if (auth instanceof Response) return auth;
  const csrf = requireCsrfToken(request); if (csrf) return csrf;
  if (!env.AUTH_HYPERDRIVE || !env.AUTH_ENCRYPTION_KEY) return json("REQUEST_FAILED", 503, "MFA indisponível.");
  const rl = createRateLimiter(env);
  try { if (!(await rl.check({ key: key(`mfa:enable:${auth.user.id}`) }))) return rateLimitResponse(); } catch { return rateLimitResponse(); }

  let body: unknown; try { body = await request.json(); } catch { body = {}; }
  const setup = (body as { setup?: boolean }).setup === true;
  const prisma = getPrisma();
  const identity = await prisma.authIdentity.findFirst({ where: { userId: auth.user.id, provider: "DISCORD" } });
  if (!identity) return json("REQUEST_FAILED", 400, "Vincule uma conta Discord antes de ativar MFA.");

  if (setup) {
    const secret = generateTotpSecret();
    const uri = otpauthUri(secret, auth.user.emailNormalized || auth.user.displayName || "admin");
    return Response.json({ ok: true, secret, otpauthUri: uri }, { headers: { "Cache-Control": "private, no-store" } });
  }

  const input = enableSchema.safeParse(body);
  if (!input.success) return json("REQUEST_FAILED", 400, "Código inválido.");
  if (!verifyTotp(input.data.secret, input.data.code)) return json("REQUEST_FAILED", 400, "Código MFA inválido.");
  try {
    await prisma.mfaCredential.create({ data: { userId: auth.user.id, identityId: identity.id, secretCiphertext: encryptMfaSecret(env, input.data.secret), enabledAt: new Date() } });
    return Response.json({ ok: true }, { headers: { "Cache-Control": "private, no-store" } });
  } catch {
    return json("REQUEST_FAILED", 400, "Não foi possível ativar MFA.");
  }
}
