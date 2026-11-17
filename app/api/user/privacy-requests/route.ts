import "server-only";
import { createHash } from "node:crypto";
import { Prisma } from "@prisma/client";
import { getWorkersEnv } from "@/lib/auth-api/get-env";
import { getPrisma } from "@/lib/prisma";
import { requireSession, requireCsrfToken } from "@/lib/auth/middleware";
import { hasTrustedBrowserMutation } from "@/lib/auth/browser-security";
import { createRateLimiter, rateLimitResponse } from "@/lib/auth-infrastructure/rate-limit";
import { buildAuthAuditRecord } from "@/lib/auth-domain/audit";
import { privacyRequestInputSchema } from "@/lib/privacy-request-input";
import { readPrivacyJson } from "@/lib/privacy-request-api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer", "X-Content-Type-Options": "nosniff" };
function json(body: object, status: number) { return Response.json(body, { status, headers }); }

export async function GET(request: Request) {
  const env = await getWorkersEnv();
  const auth = await requireSession(request, env);
  if (auth instanceof Response) return auth;
  if (auth.user.status !== "ACTIVE") return json({ error: "Conta indisponível." }, 403);
  if (!env.AUTH_HYPERDRIVE) return json({ error: "Serviço indisponível." }, 503);
  try {
    const requests = await getPrisma().privacyRequest.findMany({
      where: { userId: auth.user.id },
      select: { id: true, kind: true, status: true, createdAt: true, updatedAt: true },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: 50,
    });
    return json({ requests }, 200);
  } catch { return json({ error: "Não foi possível consultar solicitações." }, 503); }
}

export async function POST(request: Request) {
  const env = await getWorkersEnv();
  const auth = await requireSession(request, env);
  if (auth instanceof Response) return auth;
  if (auth.user.status !== "ACTIVE") return json({ error: "Conta indisponível." }, 403);
  if (!hasTrustedBrowserMutation(request.headers, String(env.APP_URL ?? ""))) return json({ error: "Origem inválida." }, 403);
  const csrf = requireCsrfToken(request);
  if (csrf) return csrf;
  if (!env.AUTH_HYPERDRIVE) return json({ error: "Serviço indisponível." }, 503);
  // Extra per-account limit beyond the existing protected-IP rate limiter.
  const rate = createRateLimiter(env);
  const key = createHash("sha256").update("swiftmc:privacy:create:v1\0" + auth.user.id).digest("hex");
  try { if (!(await rate.check({ key }))) return rateLimitResponse(); } catch { return rateLimitResponse(); }
  let body: unknown;
  try { body = await readPrivacyJson(request); }
  catch (error) { return json({ error: error instanceof RangeError ? "Corpo da solicitação excede o limite." : "Envie JSON válido." }, error instanceof RangeError ? 413 : 400); }
  const input = privacyRequestInputSchema.safeParse(body);
  if (!input.success) return json({ error: "Solicitação inválida. Limite de 800 caracteres." }, 400);
  try {
    const db = getPrisma();
    const result = await db.$transaction(async tx => {
      const existing = await tx.privacyRequest.findFirst({
        where: { userId: auth.user.id, kind: input.data.kind, status: { in: ["OPEN", "IN_REVIEW"] } },
        select: { id: true, status: true, createdAt: true },
      });
      if (existing) return { existing: true, row: existing };
      const row = await tx.privacyRequest.create({
        data: { userId: auth.user.id, kind: input.data.kind, details: input.data.details || null },
        select: { id: true, status: true, createdAt: true },
      });
      await tx.authAuditEvent.create({ data: buildAuthAuditRecord({
        eventType: "PRIVACY_REQUEST_CREATED", outcome: "success",
        requestId: crypto.randomUUID(), actorUserId: auth.user.id, subjectUserId: auth.user.id,
        metadata: { kind: input.data.kind, status: "OPEN" },
      }) });
      return { existing: false, row };
    });
    return json({ ok: true, alreadyRequested: result.existing, request: result.row }, result.existing ? 200 : 201);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002")
      return json({ ok: true, alreadyRequested: true }, 200);
    return json({ error: "Não foi possível registrar a solicitação." }, 503);
  }
}
