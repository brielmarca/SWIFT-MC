import "server-only";
import { hashPassword, isPasswordPolicyValid } from "@/lib/auth/password";
import { normalizeAuthEmail } from "@/lib/auth/email";
import { generateSecurityToken, digestSecurityToken } from "@/lib/auth/tokens";
import { sanitizeAuthAuditMetadata } from "@/lib/auth/audit-metadata";
import {
  UserRepository, IdentityRepository, PasswordCredentialRepository,
  EmailChallengeRepository,
} from "./repositories";
import { AuditRepository } from "./repositories";
import { SessionService } from "./session-service";
import { Clock } from "./clock";
import { RollbackRequiredError } from "./errors";

/**
 * From the first write of a reset (the atomic challenge consumption) onward a
 * failure can no longer be returned as `{ ok: false }`: the caller's transaction
 * would commit the partial security state. These paths audit nothing because the
 * audit record itself would roll back with the writes it describes; the public
 * failure response still propagates from the route.
 */

export type ResetRequest = {
  email: string;
};

export type ResetCompleteRequest = {
  email: string;
  challengeToken: string;
  newPassword: string;
};

export interface PasswordResetDeps {
  userRepository: UserRepository;
  identityRepository: IdentityRepository;
  passwordCredentialRepository: PasswordCredentialRepository;
  emailChallengeRepository: EmailChallengeRepository;
  sessionService: SessionService;
  auditRepository: AuditRepository;
  clock: Clock;
}

export interface PasswordResetService {
  /**
   * Request a password reset. Returns a generic public acknowledgement that never
   * reveals whether the email exists. A PASSWORD_RESET challenge is created when
   * the email exists; the token is delivered out of band (email) in production.
   * The raw challenge token is returned for email delivery.
   */
  requestPasswordReset(params: {
    email: string;
    requestId: string;
  }): Promise<{ ok: true; acknowledgement: string; challengeToken?: string }>;

  /**
   * Complete a password reset. Requires a valid, unexpired, single-use challenge
   * of purpose PASSWORD_RESET. Replaces the password hash, increments authVersion,
   * revokes existing sessions, and invalidates outstanding recovery challenges.
   *
   * MUST be invoked inside a single transaction (withAuthTransaction). The
   * challenge consumption happens first; every later failure (binding mismatch,
   * concurrent credential replacement, failed authVersion increment) throws
   * RollbackRequiredError so the consumed challenge, password replacement,
   * version increment and session revocation all roll back together instead of
   * committing partial security state.
   */
  completePasswordReset(params: {
    email: string;
    challengeToken: string;
    newPassword: string;
    requestId: string;
  }): Promise<{ ok: true; userId: string } | { ok: false; code: "RESET_FAILED" }>;
}

export function createPasswordResetService(deps: PasswordResetDeps): PasswordResetService {
  const {
    userRepository, identityRepository, passwordCredentialRepository,
    emailChallengeRepository, sessionService, auditRepository,
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

  return {
    async requestPasswordReset({ email, requestId }) {
      // Normalize email (throws on invalid). Generic acknowledgement regardless
      // of whether the account exists; no account-existence disclosure.
      const normalizedEmail = normalizeAuthEmail(email);

      let challengeToken: string | undefined;

      // Check whether an account with an EMAIL_PASSWORD identity exists.
      const user = await userRepository.findByNormalizedEmail(normalizedEmail);
      if (user) {
        const identity = await identityRepository.findByUserAndProvider(user.id, "EMAIL_PASSWORD");
        if (identity) {
          // Create a single-use PASSWORD_RESET challenge.
          const token = generateSecurityToken("password-reset");
          const tokenHash = digestSecurityToken(token, "password-reset");
          const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
          await emailChallengeRepository.create({
            userId: user.id,
            emailNormalized: normalizedEmail,
            purpose: "PASSWORD_RESET",
            tokenHash,
            authVersion: user.authVersion,
            expiresAt,
          });
          challengeToken = token;
        }
      }

      await recordAudit({
        eventType: "PASSWORD_RESET_REQUESTED",
        outcome: "success",
        actorUserId: null,
        subjectUserId: null,
        metadata: sanitizeAuthAuditMetadata({ requestId, purpose: "PASSWORD_RESET" }),
      });

      return {
        ok: true,
        acknowledgement: "Se for possível, enviaremos as instruções para o email informado.",
        ...(challengeToken !== undefined ? { challengeToken } : {}),
      };
    },

    async completePasswordReset({ email, challengeToken, newPassword, requestId }) {
      const normalizedEmail = normalizeAuthEmail(email);
      if (!isPasswordPolicyValid(newPassword)) return { ok: false, code: "RESET_FAILED" };

      // Atomically consume the challenge: single-use, unexpired, correct purpose.
      // This is the first write of the transaction. Every failure after it throws
      // RollbackRequiredError so the consumption is rolled back with it.
      const challengeTokenHash = digestSecurityToken(challengeToken, "password-reset");
      const challenge = await emailChallengeRepository.consume(challengeTokenHash);
      if (!challenge) {
        // Nothing was written: an ordinary failure result cannot commit partial
        // security state, and the failure audit persists on its own.
        await recordAudit({
          eventType: "PASSWORD_RESET_COMPLETED",
          outcome: "failure",
          actorUserId: null,
          subjectUserId: null,
          metadata: sanitizeAuthAuditMetadata({ requestId, reason: "INVALID_CREDENTIALS" }),
        });
        return { ok: false, code: "RESET_FAILED" };
      }
      if (challenge.purpose !== "PASSWORD_RESET" || challenge.emailNormalized !== normalizedEmail) {
        throw new RollbackRequiredError("RESET_FAILED", "INVALID_CHALLENGE");
      }

      const user = await userRepository.findByNormalizedEmail(normalizedEmail);
      if (!user || user.status !== "ACTIVE" || challenge.userId !== user.id || challenge.authVersion !== user.authVersion) {
        throw new RollbackRequiredError("RESET_FAILED", "INVALID_CHALLENGE");
      }

      const identity = await identityRepository.findByUserAndProvider(user.id, "EMAIL_PASSWORD");
      if (!identity) {
        throw new RollbackRequiredError("RESET_FAILED", "MISSING_IDENTITY");
      }

      const credential = await passwordCredentialRepository.findByIdentity(identity.id);
      if (!credential) {
        throw new RollbackRequiredError("RESET_FAILED", "MISSING_CREDENTIAL");
      }

      // Hash the new password before storing. Only the hash is ever persisted.
      const passwordHash = await hashPassword(newPassword);

      // Expected-state credential replacement: the row is only updated while it
      // still holds the hash read inside this transaction, so a reset can never
      // overwrite a password that was replaced concurrently.
      const replaced = await passwordCredentialRepository.replacePasswordHashIfUnchanged(
        identity.id, credential.passwordHash, passwordHash,
      );
      if (!replaced) {
        throw new RollbackRequiredError("RESET_FAILED", "CREDENTIAL_MODIFIED");
      }

      // Conditional authVersion increment: the replacement above already
      // succeeded, so a returned failure object would commit it without
      // invalidating sessions. Throw to roll the whole mutation back.
      const bumped = await userRepository.bumpAuthVersion(user.id, user.authVersion);
      if (!bumped) {
        throw new RollbackRequiredError("RESET_FAILED", "AUTH_VERSION_MISMATCH");
      }

      // Revoke existing sessions (logout-all on password reset) to prevent
      // session fixation after a password change.
      await sessionService.revokeAllUserSessions(user.id);

      // Invalidate outstanding recovery challenges for this email.
      await emailChallengeRepository.invalidateOutstanding(normalizedEmail, "PASSWORD_RESET");

      await recordAudit({
        eventType: "PASSWORD_RESET_COMPLETED",
        outcome: "success",
        actorUserId: null,
        subjectUserId: user.id,
        metadata: sanitizeAuthAuditMetadata({ requestId }),
      });

      return { ok: true, userId: user.id };
    },
  };
}
