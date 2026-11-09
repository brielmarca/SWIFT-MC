import "server-only";
import { z } from "zod";
import { getWorkersEnv } from "@/lib/auth-api/get-env";
import { withAuthPrisma } from "@/lib/auth-infrastructure/prisma";
import { requireSession, requireCsrfToken } from "@/lib/auth/middleware";
import type { AuthBindings } from "@/lib/auth-infrastructure/bindings";

const UpdateProfileSchema = z.object({
  displayName: z.string().min(1).max(100),
}).strict();

function jsonError(code: string, message: string, status: number): Response {
  return Response.json({ error: { code, message } }, { status, headers: { "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer" } });
}

export async function GET(request: Request): Promise<Response> {
  const env = await getWorkersEnv();
  const auth = await requireSession(request, env);
  if (auth instanceof Response) return auth;

  const { user } = auth;

  try {
    return await withAuthPrisma(env as Pick<AuthBindings, "AUTH_HYPERDRIVE">, async (prisma) => {
      const dbUser = await prisma.user.findUnique({
        where: { id: user.id },
        select: {
          id: true,
          emailNormalized: true,
          emailVerifiedAt: true,
          displayName: true,
          role: true,
          status: true,
          createdAt: true,
        },
      });

      if (!dbUser) {
        return jsonError("USER_NOT_FOUND", "Usuário não encontrado.", 404);
      }

      return Response.json({
        user: {
          id: dbUser.id,
          emailNormalized: dbUser.emailNormalized,
          emailVerifiedAt: dbUser.emailVerifiedAt,
          displayName: dbUser.displayName,
          role: dbUser.role,
          status: dbUser.status,
          createdAt: dbUser.createdAt,
        },
      }, {
        status: 200,
        headers: { "Cache-Control": "private, no-store" },
      });
    });
  } catch {
    return jsonError("REQUEST_FAILED", "Não foi possível carregar o perfil.", 500);
  }
}

export async function POST(request: Request): Promise<Response> {
  const env = await getWorkersEnv();
  const auth = await requireSession(request, env);
  if (auth instanceof Response) return auth;

  // CSRF protection for state-changing POST
  const csrfError = requireCsrfToken(request);
  if (csrfError) return csrfError;

  const { user } = auth;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError("REQUEST_FAILED", "Corpo da requisição inválido.", 400);
  }

  const input = UpdateProfileSchema.safeParse(body);
  if (!input.success) {
    return jsonError("REQUEST_FAILED", "Dados de perfil inválidos.", 400);
  }

  const { displayName } = input.data;

  try {
    return await withAuthPrisma(env as Pick<AuthBindings, "AUTH_HYPERDRIVE">, async (prisma) => {
      // Only update displayName. Email is never changeable through this endpoint.
      const dbUser = await prisma.user.update({
        where: { id: user.id },
        data: { displayName },
        select: {
          id: true,
          emailNormalized: true,
          emailVerifiedAt: true,
          displayName: true,
          role: true,
          status: true,
          createdAt: true,
        },
      });

      return Response.json({
        user: {
          id: dbUser.id,
          emailNormalized: dbUser.emailNormalized,
          emailVerifiedAt: dbUser.emailVerifiedAt,
          displayName: dbUser.displayName,
          role: dbUser.role,
          status: dbUser.status,
          createdAt: dbUser.createdAt,
        },
      }, {
        status: 200,
        headers: { "Cache-Control": "private, no-store" },
      });
    });
  } catch {
    return jsonError("REQUEST_FAILED", "Não foi possível atualizar o perfil.", 500);
  }
}
