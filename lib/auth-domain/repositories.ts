import "server-only";
import {
  AuthUser, AuthIdentity, PasswordCredential, AuthSession, AuthBrowserContext,
  OAuthTransaction, EmailChallenge, AuthAuditRecord, AuthProvider, AuthRole, AuthStatus,
  OAuthIntent, EmailChallengePurpose,
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
  AuthProvider, AuthRole, AuthStatus, OAuthIntent, EmailChallengePurpose,
} from "./types";

export interface UserRepository {
  /** Read a user by id, including current role/status/authVersion. */
  findById(userId: string): Promise<AuthUser | null>;
  /** Read the canonical user by normalized email. */
  findByNormalizedEmail(emailNormalized: string): Promise<AuthUser | null>;
  /**
   * Create a new user. Server-controlled fields only: role, status, authVersion.
   */
  createUser(params: {
    emailNormalized: string | null;
    displayName: string;
    role: AuthRole;
    status: AuthStatus;
    authVersion: number;
    emailVerifiedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
  }): Promise<AuthUser>;
  /**
   * Security-version mutation contract.
   * Atomically bumps authVersion only when the current value equals expectedAuthVersion.
   * Returns false when a concurrent change occurred (zero rows matched).
   */
  bumpAuthVersion(userId: string, expectedAuthVersion: number): Promise<boolean>;
  /**
   * Updates a user's emailVerifiedAt timestamp after successful verification.
   */
  updateEmailVerifiedAt(userId: string, emailVerifiedAt: Date): Promise<void>;
  updateProfile(userId: string, data: { displayName: string; phoneE164: string | null }): Promise<AuthUser>;
  updateEmail(userId: string, emailNormalized: string, emailVerifiedAt: Date): Promise<AuthUser>;
}

export interface IdentityRepository {
  /** Find a provider identity by provider + stable provider subject. */
  findByProviderAndSubject(provider: AuthProvider, providerSubject: string): Promise<AuthIdentity | null>;
  /** Find an identity for a given user + provider. */
  findByUserAndProvider(userId: string, provider: AuthProvider): Promise<AuthIdentity | null>;
  /** Resolve the owning user for an identity id. */
  resolveOwner(identityId: string): Promise<{ userId: string; user: AuthUser } | null>;
  /** Create a new provider identity. */
  createIdentity(params: {
    userId: string;
    provider: AuthProvider;
    providerSubject: string;
    createdAt: Date;
  }): Promise<AuthIdentity>;
  deleteByUserAndProvider(userId: string, provider: AuthProvider): Promise<void>;
  updateProviderSubject(userId: string, provider: AuthProvider, providerSubject: string): Promise<void>;
}

export interface LoginAttemptRepository {
  /** Atomically enforce lockout and record verification against the same hash.
   * Five consecutive failures lock the credential for 15 minutes. Attempts
   * during lockout cannot clear or extend it; expiry/success resets the count.
   * Returns true only for a valid, unlocked, unchanged credential.
   */
  recordLoginAttempt(identityId: string, expectedPasswordHash: string, passwordOk: boolean): Promise<boolean>;
}

export interface PasswordCredentialRepository {
  /** Find the password credential for an EMAIL_PASSWORD identity. */
  findByIdentity(identityId: string): Promise<PasswordCredential | null>;
  /** Create a new password credential (hash only, never plaintext). */
  createPasswordHash(identityId: string, passwordHash: string): Promise<void>;
  /**
   * Replaces the stored password hash only when it still equals
   * expectedPasswordHash: a single conditional UPDATE whose WHERE clause carries
   * the previously verified credential state. Returns false when the stored
   * credential changed concurrently (zero rows matched), so a request verified
   * against a stale hash fails without modifying the newer credential. This is
   * the only credential-replacement primitive; password change/reset must run it
   * inside the caller's transaction together with the authVersion increment and
   * session revocation.
   */
  replacePasswordHashIfUnchanged(identityId: string, expectedPasswordHash: string, passwordHash: string): Promise<boolean>;
}

export interface SessionRepository {
  /** Persist a new session, storing only the token digest (never the raw token). */
  create(params: {
    userId: string;
    tokenHash: string;
    authVersion: number;
    idleExpiresAt: Date;
    absoluteExpiresAt: Date;
    mfaVerifiedAt?: Date | null;
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
