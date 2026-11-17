import "server-only";
import { getWorkersEnv } from "@/lib/auth-api/get-env";
import { withAuthPrisma } from "@/lib/auth-infrastructure/prisma";
import { requireSession } from "@/lib/auth/middleware";
import type { AuthBindings } from "@/lib/auth-infrastructure/bindings";

function jsonError(code: string, message: string, status: number): Response {
  return Response.json({ error: { code, message } }, { status, headers: { "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer" } });
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ orderNumber: string }> },
): Promise<Response> {
  const env = await getWorkersEnv();
  const auth = await requireSession(request, env);
  if (auth instanceof Response) return auth;

  const { user } = auth;
  const { orderNumber } = await params;

  try {
    return await withAuthPrisma(env as Pick<AuthBindings, "AUTH_HYPERDRIVE">, async (prisma) => {
      // Ownership check: only return the order if it belongs to the authenticated user
      const order = await prisma.order.findFirst({
        where: {
          orderNumber,
          userId: user.id,
        },
        select: {
          id: true,
          publicToken: true,
          orderNumber: true,
          status: true,
          rankSlug: true,
          rankName: true,
          rankDuration: true,
          minecraftUsername: true,
          email: true,
          userId: true,
          currency: true,
          subtotalCents: true,
          discountCents: true,
          totalCents: true,
          checkoutIdempotencyKey: true,
          expiresAt: true,
          paidAt: true,
          createdAt: true,
          updatedAt: true,
          payments: {
            select: {
              id: true,
              provider: true,
              status: true,
              amountCents: true,
              currency: true,
              approvedAt: true,
              createdAt: true,
            },
          },
          fulfillment: {
            select: {
              id: true,
              status: true,
              rankSlug: true,
              minecraftUsername: true,
              fulfilledAt: true,
              createdAt: true,
            },
          },
        },
      });

      if (!order) {
        return jsonError("ORDER_NOT_FOUND", "Pedido não encontrado ou não pertence a esta conta.", 404);
      }

      return Response.json({
        order: {
          id: order.id,
          orderNumber: order.orderNumber,
          status: order.status,
          rankSlug: order.rankSlug,
          rankName: order.rankName,
          rankDuration: order.rankDuration,
          minecraftUsername: order.minecraftUsername,
          email: order.email,
          currency: order.currency,
          subtotalCents: order.subtotalCents,
          discountCents: order.discountCents,
          totalCents: order.totalCents,
          expiresAt: order.expiresAt,
          paidAt: order.paidAt,
          createdAt: order.createdAt,
          updatedAt: order.updatedAt,
          payments: order.payments.map((p) => ({
            id: p.id,
            provider: p.provider,
            status: p.status,
            amountCents: p.amountCents,
            currency: p.currency,
            approvedAt: p.approvedAt,
            createdAt: p.createdAt,
          })),
          fulfillment: order.fulfillment ? {
            id: order.fulfillment.id,
            status: order.fulfillment.status,
            rankSlug: order.fulfillment.rankSlug,
            minecraftUsername: order.fulfillment.minecraftUsername,
            fulfilledAt: order.fulfillment.fulfilledAt,
            createdAt: order.fulfillment.createdAt,
          } : null,
        },
      }, {
        status: 200,
        headers: { "Cache-Control": "private, no-store" },
      });
    });
  } catch {
    return jsonError("REQUEST_FAILED", "Não foi possível carregar o pedido.", 500);
  }
}
