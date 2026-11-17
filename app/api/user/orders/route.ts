import "server-only";
import { z } from "zod";
import { getWorkersEnv } from "@/lib/auth-api/get-env";
import { withAuthPrisma } from "@/lib/auth-infrastructure/prisma";
import { requireSession } from "@/lib/auth/middleware";
import { createRateLimiter, rateLimitResponse } from "@/lib/auth-infrastructure/rate-limit";
import { createHash } from "node:crypto";
import type { AuthBindings } from "@/lib/auth-infrastructure/bindings";

const OrderListQuerySchema = z.object({
  page: z.coerce.number().min(1).default(1),
  pageSize: z.coerce.number().min(1).max(50).default(20),
}).strict();

function jsonError(code: string, message: string, status: number): Response {
  return Response.json({ error: { code, message } }, { status, headers: { "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer" } });
}

function opaqueKey(input: string): string {
  return createHash("sha256").update(`swiftmc:auth:ratelimit:v1\0${input}`).digest("hex");
}

export async function GET(request: Request): Promise<Response> {
  const env = await getWorkersEnv();
  const auth = await requireSession(request, env);
  if (auth instanceof Response) return auth;

  const { user } = auth;

  // Rate limit orders API by user ID. Fail-closed.
  const rateLimiter = createRateLimiter(env);
  try {
    const userKey = opaqueKey(`auth:user:orders:${user.id}`);
    if (!(await rateLimiter.check({ key: userKey }))) {
      return rateLimitResponse();
    }
  } catch {
    return rateLimitResponse();
  }

  const url = new URL(request.url);
  const input = OrderListQuerySchema.safeParse({
    page: url.searchParams.get("page"),
    pageSize: url.searchParams.get("pageSize"),
  });

  if (!input.success) {
    return jsonError("REQUEST_FAILED", "Parâmetros de paginação inválidos.", 400);
  }

  const { page, pageSize } = input.data;
  const skip = (page - 1) * pageSize;

  try {
    return await withAuthPrisma(env as Pick<AuthBindings, "AUTH_HYPERDRIVE">, async (prisma) => {
      const [orders, total] = await Promise.all([
        prisma.order.findMany({
          where: { userId: user.id },
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
            totalCents: true,
            currency: true,
            createdAt: true,
            expiresAt: true,
            paidAt: true,
          },
          orderBy: { createdAt: "desc" },
          skip,
          take: pageSize,
        }),
        prisma.order.count({ where: { userId: user.id } }),
      ]);

      const totalPages = Math.ceil(total / pageSize);

      return Response.json({
        orders: orders.map((order) => ({
          id: order.id,
          orderNumber: order.orderNumber,
          status: order.status,
          rankSlug: order.rankSlug,
          rankName: order.rankName,
          rankDuration: order.rankDuration,
          minecraftUsername: order.minecraftUsername,
          email: order.email,
          totalCents: order.totalCents,
          currency: order.currency,
          createdAt: order.createdAt,
          expiresAt: order.expiresAt,
          paidAt: order.paidAt,
        })),
        pagination: {
          page,
          pageSize,
          total,
          totalPages,
          hasNextPage: page < totalPages,
          hasPreviousPage: page > 1,
        },
      }, {
        status: 200,
        headers: { "Cache-Control": "private, no-store" },
      });
    });
  } catch {
    return jsonError("REQUEST_FAILED", "Não foi possível carregar os pedidos.", 500);
  }
}
