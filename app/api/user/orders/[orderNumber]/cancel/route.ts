import "server-only";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { getWorkersEnv } from "@/lib/auth-api/get-env";
import { getPrisma } from "@/lib/prisma";
import { requireSession, requireCsrfToken } from "@/lib/auth/middleware";
import { hasTrustedBrowserMutation } from "@/lib/auth/browser-security";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.object({ reason: z.string().trim().min(1).max(800).optional() }).strict();
const ORDER_NUMBER = /^[A-Za-z0-9_-]{1,64}$/;
const eligibleStatuses = new Set(["PENDING_PAYMENT", "PAID", "FULFILLED", "REVIEW_REQUIRED"]);

function response(body: object, status: number) {
  return Response.json(body, { status, headers: { "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer", "X-Content-Type-Options": "nosniff" } });
}

/**
 * Record the customer's request only. Payment authorization, refund execution
 * and Minecraft entitlement revocation require a separate reviewed workflow.
 * Idempotent for a single order; ownership and session are mandatory.
 */
export async function POST(request: Request, { params }: { params: Promise<{ orderNumber: string }> }) {
  const env = await getWorkersEnv();
  const auth = await requireSession(request, env);
  if (auth instanceof Response) return auth;
  if (auth.user.status !== "ACTIVE") return response({ error: "Conta indisponível." }, 403);
  if (!hasTrustedBrowserMutation(request.headers, String(env.APP_URL ?? ""))) return response({ error: "Origem inválida." }, 403);
  const csrfError = requireCsrfToken(request);
  if (csrfError) return csrfError;
  if (!env.AUTH_HYPERDRIVE) return response({ error: "Serviço indisponível." }, 503);

  const { orderNumber } = await params;
  if (!ORDER_NUMBER.test(orderNumber)) return response({ error: "Pedido inválido." }, 400);
  const raw = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success) return response({ error: "Informe um motivo de até 800 caracteres ou deixe o campo vazio." }, 400);

  try {
    const prisma = getPrisma();
    const order = await prisma.order.findFirst({
      where: { orderNumber, userId: auth.user.id },
      select: { id: true, status: true },
    });
    if (!order) return response({ error: "Pedido não encontrado." }, 404);
    const existing = await prisma.orderCancellationRequest.findUnique({
      where: { orderId: order.id },
      select: { status: true, createdAt: true },
    });
    if (existing) return response({ ok: true, alreadyRequested: true, request: existing }, 200);
    if (!eligibleStatuses.has(order.status)) {
      return response({ error: "Este pedido não aceita solicitação por este formulário. Contate o atendimento." }, 409);
    }
    const created = await prisma.orderCancellationRequest.create({
      data: { orderId: order.id, userId: auth.user.id, reason: parsed.data.reason || null },
      select: { status: true, createdAt: true },
    });
    return response({ ok: true, alreadyRequested: false, request: created }, 201);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      // A concurrent submission already created the unique request.
      return response({ ok: true, alreadyRequested: true }, 200);
    }
    return response({ error: "Não foi possível registrar a solicitação agora." }, 503);
  }
}
