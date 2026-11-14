import "server-only";
import { verifyPassword, hashPassword, isPasswordPolicyValid } from "@/lib/auth/password";
import { normalizeAuthEmail } from "@/lib/auth/email";
import { publicLoginFailure, PUBLIC_EMAIL_CHALLENGE_ACK } from "@/lib/auth/errors";
import { sanitizeAuthAuditMetadata } from "@/lib/auth/audit-metadata";
import { LoginOutcome } from "./types";
import {
  UserRepository, IdentityRepository, PasswordCredentialRepository, LoginAttemptRepository,
  EmailChallengeRepository,
} from "./repositories";
import { SessionService } from "./session-service";
import { AuditRepository } from "./repositories";
import { Clock } from "./clock";
import { AUTH_AUDIT_EVENTS } from "./audit";
import { RollbackRequiredError } from "./errors";

const DUMMY_PASSWORD = "swiftmc-login-dummy";
const DUMMY_PASSWORD_HASH =
  "$swiftmc$scrypt$v=1$N=32768,r=8,p=3$AAAAAAAAAAAAAAAAAAAAAA$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";

/**
 * Fixed dummy hash used for equivalent verification work on missing/invalid
 * account paths. It is never regenerated per login and does not represent a
 * real credential.
 */
async function dummyPasswordWork(): Promise<void> {
  await verifyPassword(DUMMY_PASSWORD, DUMMY_PASSWORD_HASH);
}

/**
 * Database-independent password-login domain service.
 *
 * All public login failures (unknown email, wrong password, missing identity,
 * missing credential, suspended, deleted) return the identical public error so
 * client-side enumeration is not possible. Missing/invalid-account paths still
 * perform equivalent scrypt work against a fixed dummy hash so timing is not
 * trivially distinguishable.
 *
 * No HTTP response, cookie, password hash, Prisma object, or raw internal
 * account state is returned.
 */

export interface PasswordLoginDeps {
  userRepository: UserRepository;
  identityRepository: IdentityRepository;
  passwordCredentialRepository: PasswordCredentialRepository;
  loginAttemptRepository: LoginAttemptRepository;
  sessionService: SessionService;
  auditRepository: AuditRepository;
  emailChallengeRepository: EmailChallengeRepository;
  clock: Clock;
}

export interface PasswordLoginService {
  login(params: {
    email: string;
    password: string;
    rememberMe: boolean;
    requestId: string;
  }): Promise<LoginOutcome>;

  /**
   * Change a user's password. Requires current password verification.
   * On success: replaces the password hash, increments authVersion (invalidating
   * all existing sessions), revokes all user sessions, and invalidates
   * outstanding password-reset challenges.
   *
   * MUST be invoked inside a single transaction (withAuthTransaction). The whole
   * mutation runs against expected state: the new hash is stored only if the
   * credential verified above is still current, and a failed authVersion
   * increment throws RollbackRequiredError so the transaction rolls back the
   * replacement instead of committing partial security state. Conflicts detected
   * before any write (unknown account, wrong current password, concurrent
   * credential replacement) return `{ ok: false }` without mutating anything.
   */
  changePassword(params: {
    email: string;
    currentPassword: string;
    newPassword: string;
    requestId: string;
  }): Promise<{ ok: true } | { ok: false; code: "CHANGE_FAILED" }>;
}

export function createPasswordLoginService(deps: PasswordLoginDeps): PasswordLoginService {
  const {
    userRepository, identityRepository, passwordCredentialRepository,
    sessionService, auditRepository, emailChallengeRepository,
  } = deps;

  async function recordAudit(params: {
    eventType: string;
    outcome: string;
    actorUserId: string | null;
    subjectUserId: string | null;
    metadata: Record<string, unknown>;
  }) {
    await auditRepository.append({
      eventType: params.eventType,
      outcome: params.outcome,
      requestId: (params.metadata.requestId as string) ?? "",
      metadata: sanitizeAuthAuditMetadata(params.metadata),
      actorUserId: params.actorUserId,
      subjectUserId: params.subjectUserId,
    });
  }

  async function genericFailure(metadata: Record<string, unknown>, reason: string, subjectUserId: string | null): Promise<LoginOutcome> {
    await dummyPasswordWork();
    await recordAudit({
      eventType: "LOGIN_FAILURE",
      outcome: "failure",
      actorUserId: null,
      subjectUserId,
      metadata: sanitizeAuthAuditMetadata({ ...metadata, reason }),
    });
    return { ok: false, code: "LOGIN_FAILED" };
  }

  return {
    async login({ email, password, rememberMe, requestId }) {
      const normalizedEmail = normalizeAuthEmail(email);
      const metadataBase = sanitizeAuthAuditMetadata({
        requestId,
        rememberMe,
        attemptCount: 1,
        provider: "EMAIL_PASSWORD",
      });

      // Step 1-2: find canonical user. Not found => dummy work + generic failure.
      const user = await userRepository.findByNormalizedEmail(normalizedEmail);
      if (!user) {
        return genericFailure(metadataBase, "INVALID_CREDENTIALS", null);
      }

      // Step 3: resolve EMAIL_PASSWORD identity.
      const identity = await identityRepository.findByUserAndProvider(user.id, "EMAIL_PASSWORD");
      if (!identity) {
        return genericFailure(metadataBase, "INVALID_CREDENTIALS", user.id);
      }

      // Step 4: resolve password credential.
      const credential = await passwordCredentialRepository.findByIdentity(identity.id);
      if (!credential) {
        return genericFailure(metadataBase, "INVALID_CREDENTIALS", user.id);
      }

      // Step 5: perform password verification against the real hash.
      const passwordOk = await verifyPassword(password, credential.passwordHash);

      // Verify even while locked so the public result/work stays generic.
      const loginAllowed = await deps.loginAttemptRepository.recordLoginAttempt(
        identity.id, credential.passwordHash, passwordOk,
      );

      // Step 6: enforce ACTIVE status and current authVersion before issuing.
      const currentUser = await userRepository.findById(user.id);
      const active = currentUser?.status === "ACTIVE";
      const authVersionOk = currentUser?.authVersion === user.authVersion;

      const credentialsValid = currentUser !== null && passwordOk && loginAllowed && active && authVersionOk;

      if (!credentialsValid) {
        // Real verification already ran above; keep generic public failure.
        await recordAudit({
          eventType: "LOGIN_FAILURE",
          outcome: "failure",
          actorUserId: null,
          subjectUserId: user.id,
          metadata: sanitizeAuthAuditMetadata({ ...metadataBase, reason: "INVALID_CREDENTIALS" }),
        });
        return { ok: false, code: "LOGIN_FAILED" };
      }

      // Step 8: Revoke all existing sessions for this user (session rotation on login).
      await sessionService.revokeAllUserSessions(currentUser.id);

      // Step 9: issue a new session. Privileged roles never receive remember-me or MFA trust here.
      const isPrivilegedAdmin = currentUser.role === "ADMIN" || currentUser.role === "OWNER";
      const issued = await sessionService.issueSession({
        userId: currentUser.id,
        authVersion: currentUser.authVersion,
        rememberMe: isPrivilegedAdmin ? false : rememberMe,
        isPrivilegedAdmin,
        mfaVerifiedAt: null,
      });

      if (!issued.ok) {
        await recordAudit({
          eventType: "LOGIN_FAILURE",
          outcome: "failure",
          actorUserId: null,
          subjectUserId: user.id,
          metadata: sanitizeAuthAuditMetadata({ ...metadataBase, reason: "INVALID_CREDENTIALS" }),
        });
        return { ok: false, code: "LOGIN_FAILED" };
      }

      await recordAudit({
        eventType: "LOGIN_SUCCESS",
        outcome: "success",
        actorUserId: user.id,
        subjectUserId: user.id,
        metadata: sanitizeAuthAuditMetadata({ ...metadataBase }),
      });

      // Step 10: return domain result only. Raw token goes to the cookie setter.
      return { ok: true, session: issued.session, user, rawToken: issued.rawToken };
    },

    /**
     * Change a user's password. Requires current password verification.
     * On success: replaces the password hash, increments authVersion (invalidating
     * all existing sessions), revokes all user sessions, and invalidates
     * outstanding password-reset challenges. The caller must supply
     * transaction-scoped repositories (withAuthTransaction); failures after the
     * first write throw RollbackRequiredError so the transaction rolls back.
     */
    async changePassword(params: {
      email: string;
      currentPassword: string;
      newPassword: string;
      requestId: string;
    }): Promise<{ ok: true } | { ok: false; code: "CHANGE_FAILED" }> {
      if (!isPasswordPolicyValid(params.newPassword)) return { ok: false, code: "CHANGE_FAILED" };
      const normalizedEmail = normalizeAuthEmail(params.email);
      const metadataBase = sanitizeAuthAuditMetadata({
        requestId: params.requestId,
        provider: "EMAIL_PASSWORD",
      });

      // Find the canonical user. Not found => dummy work + generic failure.
      const user = await userRepository.findByNormalizedEmail(normalizedEmail);
      if (!user) {
        await dummyPasswordWork();
        await recordAudit({
          eventType: "PASSWORD_CHANGED",
          outcome: "failure",
          actorUserId: null,
          subjectUserId: null,
          metadata: sanitizeAuthAuditMetadata({ ...metadataBase, reason: "INVALID_CREDENTIALS" }),
        });
        return { ok: false, code: "CHANGE_FAILED" };
      }

      // Resolve EMAIL_PASSWORD identity.
      const identity = await identityRepository.findByUserAndProvider(user.id, "EMAIL_PASSWORD");
      if (!identity) {
        await dummyPasswordWork();
        await recordAudit({
          eventType: "PASSWORD_CHANGED",
          outcome: "failure",
          actorUserId: null,
          subjectUserId: user.id,
          metadata: sanitizeAuthAuditMetadata({ ...metadataBase, reason: "INVALID_CREDENTIALS" }),
        });
        return { ok: false, code: "CHANGE_FAILED" };
      }

      // Resolve password credential.
      const credential = await passwordCredentialRepository.findByIdentity(identity.id);
      if (!credential) {
        await dummyPasswordWork();
        await recordAudit({
          eventType: "PASSWORD_CHANGED",
          outcome: "failure",
          actorUserId: null,
          subjectUserId: user.id,
          metadata: sanitizeAuthAuditMetadata({ ...metadataBase, reason: "INVALID_CREDENTIALS" }),
        });
        return { ok: false, code: "CHANGE_FAILED" };
      }

      // Verify current password.
      const currentPasswordOk = await verifyPassword(params.currentPassword, credential.passwordHash);
      if (!currentPasswordOk) {
        await recordAudit({
          eventType: "PASSWORD_CHANGED",
          outcome: "failure",
          actorUserId: null,
          subjectUserId: user.id,
          metadata: sanitizeAuthAuditMetadata({ ...metadataBase, reason: "INVALID_CREDENTIALS" }),
        });
        return { ok: false, code: "CHANGE_FAILED" };
      }

      // Hash the new password.
      const newPasswordHash = await hashPassword(params.newPassword);

      // Expected-state credential replacement: the row is only updated while it
      // still holds the exact hash verified above, so a request that observed a
      // stale credential cannot overwrite a concurrent password change. Zero rows
      // matched means nothing was written yet, so an ordinary failure result is
      // safe here.
      const replaced = await passwordCredentialRepository.replacePasswordHashIfUnchanged(
        identity.id, credential.passwordHash, newPasswordHash,
      );
      if (!replaced) {
        await recordAudit({
          eventType: "PASSWORD_CHANGED",
          outcome: "failure",
          actorUserId: null,
          subjectUserId: user.id,
          metadata: sanitizeAuthAuditMetadata({ ...metadataBase, reason: "INVALID_CREDENTIALS" }),
        });
        return { ok: false, code: "CHANGE_FAILED" };
      }

      // Conditional authVersion increment against the version read in this
      // transaction. The replacement above already succeeded, so returning a
      // failure object would commit a new password without invalidating
      // sessions: fail by throwing to roll back the replacement as well.
      const bumped = await userRepository.bumpAuthVersion(user.id, user.authVersion);
      if (!bumped) {
        throw new RollbackRequiredError("CHANGE_FAILED", "AUTH_VERSION_MISMATCH");
      }

      // Revoke all existing sessions (logout-all on password change).
      await sessionService.revokeAllUserSessions(user.id);

      // Outstanding password-reset challenges were bound to the old credential
      // state; invalidate them explicitly inside the same transaction.
      await emailChallengeRepository.invalidateOutstanding(normalizedEmail, "PASSWORD_RESET");

      await recordAudit({
        eventType: AUTH_AUDIT_EVENTS.PASSWORD_CHANGED,
        outcome: "success",
        actorUserId: user.id,
        subjectUserId: user.id,
        metadata: sanitizeAuthAuditMetadata({ ...metadataBase }),
      });

      return { ok: true };
    },
  };
}

export { publicLoginFailure, PUBLIC_EMAIL_CHALLENGE_ACK };
