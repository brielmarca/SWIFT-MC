import "server-only";
import { normalizeAuthEmail } from "@/lib/auth/email";
import { sanitizeAuthAuditMetadata } from "@/lib/auth/audit-metadata";
import {
  UserRepository, IdentityRepository, PasswordCredentialRepository, EmailChallengeRepository,
} from "./repositories";
import { AuditRepository } from "./repositories";
import { Clock } from "./clock";

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
  auditRepository: AuditRepository;
  clock: Clock;
}

export interface PasswordResetService {
  /**
   * Request a password reset. Returns a generic public acknowledgement that never
   * reveals whether the email exists. A challenge is created only when appropriate
   * (future implementation).
   */
  requestPasswordReset(params: {
    email: string;
    requestId: string;
  }): Promise<{ ok: true; acknowledgement: string }>;

  /**
   * Complete a password reset. Requires a valid, unexpired, single-use challenge
   * of purpose PASSWORD_RESET. Replaces the password hash, increments authVersion,
   * revokes existing sessions, and invalidates outstanding recovery challenges.
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
    emailChallengeRepository, auditRepository,
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
      normalizeAuthEmail(email);

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
      };
    },

    async completePasswordReset({ email, challengeToken, newPassword, requestId }) {
      const normalizedEmail = normalizeAuthEmail(email);

      // Atomically consume the challenge: single-use, unexpired, correct purpose.
      const challenge = await emailChallengeRepository.consume(challengeToken);
      if (!challenge) {
        await recordAudit({
          eventType: "PASSWORD_RESET_COMPLETED",
          outcome: "failure",
          actorUserId: null,
          subjectUserId: null,
          metadata: sanitizeAuthAuditMetadata({ requestId, reason: "INVALID_CHALLENGE" }),
        });
        return { ok: false, code: "RESET_FAILED" };
      }
      if (challenge.purpose !== "PASSWORD_RESET") {
        await recordAudit({
          eventType: "PASSWORD_RESET_COMPLETED",
          outcome: "failure",
          actorUserId: null,
          subjectUserId: null,
          metadata: sanitizeAuthAuditMetadata({ requestId, reason: "INVALID_CHALLENGE" }),
        });
        return { ok: false, code: "RESET_FAILED" };
      }

      const user = await userRepository.findByNormalizedEmail(normalizedEmail);
      if (!user) {
        await recordAudit({
          eventType: "PASSWORD_RESET_COMPLETED",
          outcome: "failure",
          actorUserId: null,
          subjectUserId: null,
          metadata: sanitizeAuthAuditMetadata({ requestId, reason: "INVALID_CHALLENGE" }),
        });
        return { ok: false, code: "RESET_FAILED" };
      }

      const identity = await identityRepository.findByUserAndProvider(user.id, "EMAIL_PASSWORD");
      if (!identity) {
        await recordAudit({
          eventType: "PASSWORD_RESET_COMPLETED",
          outcome: "failure",
          actorUserId: null,
          subjectUserId: user.id,
          metadata: sanitizeAuthAuditMetadata({ requestId, reason: "INVALID_CHALLENGE" }),
        });
        return { ok: false, code: "RESET_FAILED" };
      }

      // Replace the password hash (repository hashes in real implementation).
      await passwordCredentialRepository.replacePasswordHash(identity.id, newPassword);

      // Increment authVersion to invalidate all existing sessions/authorization.
      const bumped = await userRepository.bumpAuthVersion(user.id, user.authVersion);
      if (!bumped) {
        await recordAudit({
          eventType: "PASSWORD_RESET_COMPLETED",
          outcome: "failure",
          actorUserId: null,
          subjectUserId: user.id,
          metadata: sanitizeAuthAuditMetadata({ requestId, reason: "AUTH_VERSION_MISMATCH" }),
        });
        return { ok: false, code: "RESET_FAILED" };
      }

      // Revoke existing sessions (logout-all on password reset).
      // Future: call sessionService.revokeAllUserSessions(user.id).
      void user.id;

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
