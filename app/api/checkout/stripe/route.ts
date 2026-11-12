import { createHash } from "node:crypto";
import { z } from "zod";
import { getWorkersEnv } from "@/lib/auth-api/get-env";
import { requireSession, requireCsrfToken } from "@/lib/auth/middleware";
import { hasTrustedBrowserMutation } from "@/lib/auth/browser-security";
import { withAuthPrisma } from "@/lib/auth-infrastructure/prisma";
import { getStripeConfig } from "@/lib/server-env";
import { createStripeCheckoutClient, startStripeCheckout } from "@/lib/payments/stripe-checkout";
import { createOrder } from "@/lib/orders/create-order";
import { validateOrderInput } from "@/lib/orders/order-input";
import { getLinkedMinecraftIdentityForUser, orderIdentityLabel } from "@/lib/minecraft-bridge/purchase";
import { purchasesEnabled, purchasesDisabledResponse } from "@/lib/purchase-gate";

const inputSchema = z.object({
  type: z.enum(["vip", "cash"]),
  rankSlug: z.string().max(32),
  idempotencyKey: z.uuid(),
}).strict();
const headers = { "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer" };
function error(code: string, message: string, status: number) {
  return Response.json({ error: { code, message } }, { status, headers });
}

function isStagingTestPurchases(): boolean {
  const env = process.env;
  return env.BACKEND_RUNTIME === "node" && env.APP_ENV === "staging" && env.STRIPE_TEST_PURCHASES_ENABLED === "true" && env.PURCHASES_ENABLED === "false" && /^(sk|rk)_test_/.test(env.STRIPE_SECRET_KEY ?? "");
}

export async function POST(request: Request): Promise<Response> {
  if (!purchasesEnabled()) return purchasesDisabledResponse(request);
  const env = await getWorkersEnv();
  const auth = await requireSession(request, env);
  if (auth instanceof Response) return auth;
  if (!hasTrustedBrowserMutation(request.headers, env.APP_URL ?? "")) return error("ORIGIN_REJECTED", "Origem não permitida.", 403);
  const csrf = requireCsrfToken(request);
  if (csrf) return csrf;
  if (!auth.user.emailVerifiedAt || !auth.user.emailNormalized) return error("EMAIL_NOT_VERIFIED", "Verifique seu email antes de comprar.", 403);
  const input = inputSchema.safeParse(await request.json().catch(() => null));
  if (!input.success) return error("INVALID_INPUT", "Selecione um VIP válido.", 400);
  if ((input.data.type === "cash") !== input.data.rankSlug.startsWith("cash-")) return error("INVALID_INPUT", "Produto inválido.", 400);
  let secretKey: string;
  try { secretKey = getStripeConfig().secretKey; }
  catch { return error("CHECKOUT_UNAVAILABLE", "Pagamento indisponível. Tente novamente mais tarde.", 503); }
  try {
    return await withAuthPrisma(env, async db => {
      const stagingBypass = isStagingTestPurchases();
      const identity = await getLinkedMinecraftIdentityForUser(db, auth.user.id);
      if (!identity && !stagingBypass) return error("MINECRAFT_LINK_REQUIRED", "Vincule sua conta Minecraft antes de comprar um VIP.", 409);
      const fallbackName = auth.user.emailNormalized!.split("@")[0];
      const minecraftUsername = identity ? orderIdentityLabel(identity) : fallbackName;
      const validated = validateOrderInput({ ...input.data, minecraftUsername, email: auth.user.emailNormalized! });
      if (validated.error) return error(validated.error, "Este produto não está disponível para compra.", 400);
      const idempotencyKey = createHash("sha256").update(`stripe:v1:${auth.user.id}:${input.data.idempotencyKey}`).digest("hex");
      const order = await createOrder(db, validated.data!, { idempotencyKey, userId: auth.user.id, lifetimeMs: 60 * 60 * 1000 });
      const checkout = await startStripeCheckout(db, createStripeCheckoutClient(secretKey),
        { orderNumber: order.orderNumber, orderToken: order.paymentToken, userId: auth.user.id },
        { appUrl: new URL(env.APP_URL!) });
      return Response.json({ ...checkout, orderNumber: order.orderNumber }, { headers });
    });
  } catch (cause) {
    if (cause instanceof Error && cause.name === "IdempotencyConflictError") return error("IDEMPOTENCY_CONFLICT", "Esta tentativa pertence a outra seleção.", 409);
    if (cause instanceof Error && cause.name === "OrderNotPayableError") return error("ORDER_NOT_PAYABLE", "Pedido encerrado ou expirado. Consulte seus pedidos antes de iniciar outra compra.", 409);
    return error("CHECKOUT_UNAVAILABLE", "Não foi possível abrir o pagamento. Tente novamente com a mesma seleção.", 503);
  }
}
