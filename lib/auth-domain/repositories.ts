import "server-only";
import {
  AuthUser, AuthIdentity, PasswordCredential, AuthSession, AuthBrowserContext,
  OAuthTransaction, EmailChallenge, AuthAuditRecord, AuthProvider, OAuthIntent, EmailChallengePurpose,
} from "./types";

/**
 * Repository contracts for the authentication domain.
 *
 * These are intentionally dependency-free: no Prisma, no Hyperdrive, no database
 * types. A future Prisma implementation satisfies these interfaces without
 * changing any domain service.
 *
 * Atomic consumption semantics are represented explicitly: consume* operations
 * perform a check-and-consume in a single repository operation and return null
 * when the record is already consumed, expired, or absent, so callers cannot
 * replay a consumed challenge/transaction.
 */

export type {
  AuthUser, AuthIdentity, PasswordCredential, AuthSession, AuthBrowserContext,
  OAuthTransaction, EmailChallenge, MinecraftIdentity, AuthAuditRecord,
  AuthProvider, OAuthIntent, EmailChallengePurpose,
} from "./types";

export interface UserRepository {
  /** Read a user by id, including current role/status/authVersion. */
  findById(userId: string): Promise<AuthUser | null>;
  /** Read the canonical user by normalized email. */
  findByNormalizedEmail(emailNormalized: string): Promise<AuthUser | null>;
  /**
   * Security-version mutation contract.
   * Atomically bumps authVersion only when the current value equals expectedAuthVersion.
   * Returns true when the bump was applied, false when a concurrent change occurred.
   */
  bumpAuthVersion(userId: string, expectedAuthVersion: number): Promise<boolean>;
}

export interface IdentityRepository {
  /** Find a provider identity by provider + stable provider subject. */
  findByProviderAndSubject(provider: AuthProvider, providerSubject: string): Promise<AuthIdentity | null>;
  /** Find an identity for a given user + provider. */
  findByUserAndProvider(userId: string, provider: AuthProvider): Promise<AuthIdentity | null>;
  /** Resolve the owning user for an identity id. */
  resolveOwner(identityId: string): Promise<{ userId: string; user: AuthUser } | null>;
}

export interface PasswordCredentialRepository {
  /** Find the password credential for an EMAIL_PASSWORD identity. */
  findByIdentity(identityId: string): Promise<PasswordCredential | null>;
  /** Replace the stored password hash (called on password change/reset/enroll). */
  replacePasswordHash(identityId: string, passwordHash: string): Promise<void>;
}

export interface SessionRepository {
  /** Persist a new session, storing only the token digest (never the raw token). */
  create(params: {
    userId: string;
    tokenHash: string;
    authVersion: number;
    idleExpiresAt: Date;
    absoluteExpiresAt: Date;
  }): Promise<AuthSession>;
  /** Look up a session by its token digest. */
  findByTokenDigest(tokenHash: string): Promise<AuthSession | null>;
  /** Refresh lastSeenAt without extending absolute expiry. */
  touchLastSeen(sessionId: string, lastSeenAt: Date): Promise<void>;
  /** Revoke a single session. */
  revoke(sessionId: string, reason?: string): Promise<void>;
  /** Revoke every session belonging to a user (logout-all-devices). */
  revokeAllForUser(userId: string): Promise<void>;
  /** List a user's currently non-revoked sessions. */
  listActiveForUser(userId: string): Promise<AuthSession[]>;
}

export interface BrowserContextRepository {
  create(params: {
    tokenHash: string;
    csrfTokenHash: string;
    expiresAt: Date;
  }): Promise<AuthBrowserContext>;
  findByTokenHash(tokenHash: string): Promise<AuthBrowserContext | null>;
  /** Atomically consume a browser context token; null if already consumed/expired. */
  consume(tokenHash: string): Promise<AuthBrowserContext | null>;
  expire(tokenHash: string): Promise<void>;
}

export interface OAuthTransactionRepository {
  create(params: {
    stateHash: string;
    browserContextId: string;
    intent: OAuthIntent;
    linkUserId: string | null;
    initiatingSessionId: string | null;
    pkceVerifierCiphertext: string;
    returnPath: string;
    expiresAt: Date;
  }): Promise<OAuthTransaction>;
  /** Atomically consume a transaction; null if already consumed or expired. */
  consume(stateHash: string): Promise<OAuthTransaction | null>;
  expire(stateHash: string): Promise<void>;
}

export interface EmailChallengeRepository {
  create(params: {
    userId: string | null;
    emailNormalized: string;
    purpose: EmailChallengePurpose;
    tokenHash: string;
    authVersion: number | null;
    expiresAt: Date;
  }): Promise<EmailChallenge>;
  /** Atomically consume a challenge token; null if already consumed or expired. */
  consume(tokenHash: string): Promise<EmailChallenge | null>;
  expire(tokenHash: string): Promise<void>;
  /**
   * Invalidate outstanding (unconsumed, unexpired) challenges for an email+purpose,
   * optionally leaving one token out (e.g. the one just consumed).
   */
  invalidateOutstanding(emailNormalized: string, purpose: EmailChallengePurpose, exceptTokenHash?: string): Promise<void>;
}

export interface AuditRepository {
  /** Append a sanitized auth audit event. */
  append(record: AuthAuditRecord): Promise<void>;
}
