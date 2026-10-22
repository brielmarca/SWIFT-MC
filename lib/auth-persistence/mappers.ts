import "server-only";
import { PrismaClient } from "@prisma/client";
import {
  AuthUser, AuthIdentity, PasswordCredential, AuthSession, AuthBrowserContext,
  OAuthTransaction, EmailChallenge, AuthAuditRecord,
  AuthProvider, OAuthIntent, EmailChallengePurpose,
} from "@/lib/auth-domain/types";
import { AuthRole, AuthStatus } from "@/lib/auth-domain/types";

export type {
  PrismaUser, PrismaAuthIdentity, PrismaPasswordCredential, PrismaSession,
  PrismaAuthBrowserContext, PrismaOAuthTransaction, PrismaEmailChallenge,
  PrismaAuthAuditEvent,
};
type PrismaUser = NonNullable<Awaited<ReturnType<PrismaClient["user"]["findUnique"]>>>;
type PrismaAuthIdentity = NonNullable<Awaited<ReturnType<PrismaClient["authIdentity"]["findUnique"]>>>;
type PrismaPasswordCredential = NonNullable<Awaited<ReturnType<PrismaClient["passwordCredential"]["findUnique"]>>>;
type PrismaSession = NonNullable<Awaited<ReturnType<PrismaClient["session"]["findUnique"]>>>;
type PrismaAuthBrowserContext = NonNullable<Awaited<ReturnType<PrismaClient["authBrowserContext"]["findUnique"]>>>;
type PrismaOAuthTransaction = NonNullable<Awaited<ReturnType<PrismaClient["oAuthTransaction"]["findUnique"]>>>;
type PrismaEmailChallenge = NonNullable<Awaited<ReturnType<PrismaClient["emailChallenge"]["findUnique"]>>>;
type PrismaAuthAuditEvent = NonNullable<Awaited<ReturnType<PrismaClient["authAuditEvent"]["create"]>>>;

/** Prisma enum values are strings at runtime; map them explicitly and fail closed. */

const USER_ROLES: Readonly<Record<string, AuthRole>> = Object.freeze({
  USER: "USER",
  SUPPORT: "SUPPORT",
  MODERATOR: "MODERATOR",
  ADMIN: "ADMIN",
  OWNER: "OWNER",
});

const USER_STATUSES: Readonly<Record<string, AuthStatus>> = Object.freeze({
  ACTIVE: "ACTIVE",
  SUSPENDED: "SUSPENDED",
  DELETED: "DELETED",
});

const AUTH_PROVIDERS: Readonly<Record<string, AuthProvider>> = Object.freeze({
  EMAIL_PASSWORD: "EMAIL_PASSWORD",
  DISCORD: "DISCORD",
});

const OAUTH_INTENTS: Readonly<Record<string, OAuthIntent>> = Object.freeze({
  LOGIN: "LOGIN",
  LINK: "LINK",
});

const EMAIL_CHALLENGE_PURPOSES: Readonly<Record<string, EmailChallengePurpose>> = Object.freeze({
  REGISTER: "REGISTER",
  VERIFY_EMAIL: "VERIFY_EMAIL",
  CHANGE_EMAIL: "CHANGE_EMAIL",
  PASSWORD_RESET: "PASSWORD_RESET",
});

function mapEnum<Value extends string, Domain extends string>(
  map: Readonly<Record<string, Domain>>,
  value: Value,
  field: string,
): Domain {
  const mapped = map[value];
  if (mapped === undefined) {
    throw new Error(`Unexpected ${field} value: ${String(value)}`);
  }
  return mapped;
}

function mapUserRole(value: string): AuthRole { return mapEnum(USER_ROLES, value, "UserRole"); }
function mapUserStatus(value: string): AuthStatus { return mapEnum(USER_STATUSES, value, "UserStatus"); }
function mapAuthProvider(value: string): AuthProvider { return mapEnum(AUTH_PROVIDERS, value, "AuthProvider"); }
function mapOAuthIntent(value: string): OAuthIntent { return mapEnum(OAUTH_INTENTS, value, "OAuthIntent"); }
function mapEmailChallengePurpose(value: string): EmailChallengePurpose { return mapEnum(EMAIL_CHALLENGE_PURPOSES, value, "EmailChallengePurpose"); }

function nullableDate(value: Date | null): Date | null {
  return value;
}

export function mapUser(record: PrismaUser): AuthUser {
  return {
    id: record.id,
    emailNormalized: record.emailNormalized,
    emailVerifiedAt: nullableDate(record.emailVerifiedAt),
    displayName: record.displayName,
    role: mapUserRole(record.role),
    status: mapUserStatus(record.status),
    authVersion: record.authVersion,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

export function mapAuthIdentity(record: PrismaAuthIdentity): AuthIdentity {
  return {
    id: record.id,
    userId: record.userId,
    provider: mapAuthProvider(record.provider),
    providerSubject: record.providerSubject,
    createdAt: record.createdAt,
    lastAuthenticatedAt: nullableDate(record.lastAuthenticatedAt),
  };
}

export function mapPasswordCredential(record: PrismaPasswordCredential): PasswordCredential {
  return {
    identityId: record.identityId,
    passwordHash: record.passwordHash,
    changedAt: record.changedAt,
  };
}

export function mapSession(record: PrismaSession): AuthSession {
  return {
    id: record.id,
    userId: record.userId,
    tokenHash: record.tokenHash,
    authVersion: record.authVersion,
    createdAt: record.createdAt,
    lastSeenAt: record.lastSeenAt,
    idleExpiresAt: record.idleExpiresAt,
    absoluteExpiresAt: record.absoluteExpiresAt,
    revokedAt: nullableDate(record.revokedAt),
    revocationReason: record.revocationReason,
    authenticatedAt: record.authenticatedAt,
    mfaVerifiedAt: nullableDate(record.mfaVerifiedAt),
  };
}

export function mapBrowserContext(record: PrismaAuthBrowserContext): AuthBrowserContext {
  return {
    id: record.id,
    tokenHash: record.tokenHash,
    csrfTokenHash: record.csrfTokenHash,
    expiresAt: record.expiresAt,
    createdAt: record.createdAt,
  };
}

export function mapOAuthTransaction(record: PrismaOAuthTransaction): OAuthTransaction {
  return {
    id: record.id,
    stateHash: record.stateHash,
    browserContextId: record.browserContextId,
    intent: mapOAuthIntent(record.intent),
    linkUserId: record.linkUserId,
    initiatingSessionId: record.initiatingSessionId,
    returnPath: record.returnPath,
    expiresAt: record.expiresAt,
    consumedAt: nullableDate(record.consumedAt),
    createdAt: record.createdAt,
  };
}

export function mapEmailChallenge(record: PrismaEmailChallenge): EmailChallenge {
  return {
    id: record.id,
    userId: record.userId,
    emailNormalized: record.emailNormalized,
    purpose: mapEmailChallengePurpose(record.purpose),
    tokenHash: record.tokenHash,
    authVersion: record.authVersion,
    expiresAt: record.expiresAt,
    consumedAt: nullableDate(record.consumedAt),
    createdAt: record.createdAt,
  };
}

export function mapAuditRecord(record: PrismaAuthAuditEvent): AuthAuditRecord {
  return {
    eventType: record.eventType,
    outcome: record.outcome,
    requestId: record.requestId,
    metadata: record.metadata as Record<string, string | number | boolean>,
    actorUserId: record.actorUserId,
    subjectUserId: record.subjectUserId,
  };
}
