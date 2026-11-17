import { PrismaClient } from "@prisma/client";
import "server-only";
import { generateSecurityToken, digestSecurityToken } from "@/lib/auth/tokens";
import { withAuthPrisma } from "@/lib/auth-infrastructure/prisma";
import { createPrismaAuthRepositories, type PrismaAuthRepositories } from "@/lib/auth-persistence/prisma-auth-repositories";
import { createPasswordLoginService } from "@/lib/auth-domain/password-login";
import { createSessionService } from "@/lib/auth-domain/session-service";
import { createRegistrationService } from "@/lib/auth-domain/registration";
import { createPasswordResetService } from "@/lib/auth-domain/password-reset";
import { SystemClock } from "@/lib/auth-domain/clock";
// PasswordCredentialRepository implements LoginAttemptRepository at runtime.
import type { AuthBindings } from "@/lib/auth-infrastructure/bindings";

export interface AuthServices {
  loginService: ReturnType<typeof createPasswordLoginService>;
  sessionService: ReturnType<typeof createSessionService>;
  registrationService: ReturnType<typeof createRegistrationService>;
  passwordResetService: ReturnType<typeof createPasswordResetService>;
  repositories: PrismaAuthRepositories;
}

/**
 * Builds the complete auth service stack inside a Prisma transaction scope.
 * All repositories share the same Prisma client (request-scoped or transaction-scoped).
 * The caller owns the client lifecycle; this helper never creates or retains clients globally.
 */
export function buildAuthServices(prisma: Parameters<typeof createPrismaAuthRepositories>[0]): AuthServices {
  const repos = createPrismaAuthRepositories(prisma);
  const clock = new SystemClock();
  const sessionService = createSessionService({
    sessionRepository: repos.sessionRepository,
    userRepository: repos.userRepository,
    clock,
  });
  return {
    loginService: createPasswordLoginService({
      loginAttemptRepository: repos.passwordCredentialRepository as unknown as import("@/lib/auth-domain/repositories").LoginAttemptRepository,
      userRepository: repos.userRepository,
      identityRepository: repos.identityRepository,
      passwordCredentialRepository: repos.passwordCredentialRepository,
      sessionService,
      auditRepository: repos.auditRepository,
      emailChallengeRepository: repos.emailChallengeRepository,
      clock,
    }),
    sessionService,
    registrationService: createRegistrationService({
      userRepository: repos.userRepository,
      identityRepository: repos.identityRepository,
      passwordCredentialRepository: repos.passwordCredentialRepository,
      emailChallengeRepository: repos.emailChallengeRepository,
      auditRepository: repos.auditRepository,
      clock,
    }),
    passwordResetService: createPasswordResetService({
      userRepository: repos.userRepository,
      identityRepository: repos.identityRepository,
      passwordCredentialRepository: repos.passwordCredentialRepository,
      emailChallengeRepository: repos.emailChallengeRepository,
      sessionService,
      auditRepository: repos.auditRepository,
      clock,
    }),
    repositories: repos,
  };
}

/**
 * Executes a callback with request-scoped Prisma client and auth services bound to Hyperdrive.
 * Always disconnects the client after completion, including on failure.
 */
export async function withAuthServices<T>(
  env: Pick<AuthBindings, "AUTH_HYPERDRIVE">,
  callback: (services: AuthServices) => Promise<T>,
): Promise<T> {
  return withAuthPrisma(env, async (prisma) => {
    return callback(buildAuthServices(prisma));
  });
}

/**
 * Executes a callback inside a Prisma transaction with auth services bound to Hyperdrive.
 * All repository operations within the callback share the same transaction-scoped client,
 * ensuring atomicity for multi-repository operations (verified registration, password
 * reset, password change). Domain flows that replace credentials throw
 * RollbackRequiredError instead of returning a failure object after their first
 * write, so a rejected callback rolls back every partial mutation.
 * Always disconnects the client after completion, including on failure.
 *
 * Compatible with Cloudflare Workers, PrismaPg adapter, and Hyperdrive.
 */
export async function withAuthTransaction<T>(
  env: Pick<AuthBindings, "AUTH_HYPERDRIVE">,
  callback: (services: AuthServices) => Promise<T>,
): Promise<T> {
  return withAuthPrisma(env, async (prisma) => {
    return prisma.$transaction(async (tx) => {
      return callback(buildAuthServices(tx as unknown as PrismaClient));
    // Credential hashing shares Node's bounded worker pool. Concurrent scrypt
    // operations can exceed Prisma's 5s default before the conditional write.
    // Keep the atomic security mutations intact with a bounded 15s budget.
    }, { timeout: 15_000, maxWait: 5_000 });
  });
}

export { generateSecurityToken, digestSecurityToken };
