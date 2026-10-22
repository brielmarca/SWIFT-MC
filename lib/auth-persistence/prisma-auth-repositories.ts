import "server-only";
import { PrismaClient } from "@prisma/client";
import {
  UserRepository, IdentityRepository, PasswordCredentialRepository, SessionRepository,
  BrowserContextRepository, OAuthTransactionRepository, EmailChallengeRepository, AuditRepository,
} from "@/lib/auth-domain/repositories";
import { PrismaUserRepository } from "./prisma-user-repository";
import { PrismaIdentityRepository } from "./prisma-identity-repository";
import { PrismaPasswordCredentialRepository } from "./prisma-password-repository";
import { PrismaSessionRepository } from "./prisma-session-repository";
import { PrismaBrowserContextRepository } from "./prisma-browser-context-repository";
import { PrismaOAuthTransactionRepository } from "./prisma-oauth-transaction-repository";
import { PrismaEmailChallengeRepository } from "./prisma-email-challenge-repository";
import { PrismaAuditRepository } from "./prisma-audit-repository";

export interface PrismaAuthRepositories {
  userRepository: UserRepository;
  identityRepository: IdentityRepository;
  passwordCredentialRepository: PasswordCredentialRepository;
  sessionRepository: SessionRepository;
  browserContextRepository: BrowserContextRepository;
  oauthTransactionRepository: OAuthTransactionRepository;
  emailChallengeRepository: EmailChallengeRepository;
  auditRepository: AuditRepository;
}

/**
 * Builds the complete auth repository bundle against a single Prisma client.
 *
 * The client may be a normal request-scoped client (from withAuthPrisma) or a
 * transaction-scoped client (prisma.$transaction callback), allowing future
 * multi-repository operations (verified registration, password reset, account
 * linking) to run atomically.
 *
 * No global Prisma client is created here; the caller owns the client and its
 * lifecycle. No DATABASE_URL or Hyperdrive connection string is read here.
 */
export function createPrismaAuthRepositories(prisma: PrismaClient): PrismaAuthRepositories {
  return {
    userRepository: new PrismaUserRepository(prisma),
    identityRepository: new PrismaIdentityRepository(prisma),
    passwordCredentialRepository: new PrismaPasswordCredentialRepository(prisma),
    sessionRepository: new PrismaSessionRepository(prisma),
    browserContextRepository: new PrismaBrowserContextRepository(prisma),
    oauthTransactionRepository: new PrismaOAuthTransactionRepository(prisma),
    emailChallengeRepository: new PrismaEmailChallengeRepository(prisma),
    auditRepository: new PrismaAuditRepository(prisma),
  };
}
