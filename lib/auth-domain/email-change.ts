import "server-only";
import { normalizeAuthEmail } from "@/lib/auth/email";
import { verifyPassword } from "@/lib/auth/password";
import { generateSecurityToken, digestSecurityToken } from "@/lib/auth/tokens";
import { RollbackRequiredError } from "./errors";
import type { Clock } from "./clock";
import type { AuditRepository, EmailChallengeRepository, IdentityRepository, PasswordCredentialRepository, SessionRepository, UserRepository } from "./repositories";

export type EmailChangeDeps = {
  userRepository: UserRepository;
  identityRepository: IdentityRepository;
  passwordCredentialRepository: PasswordCredentialRepository;
  emailChallengeRepository: EmailChallengeRepository;
  sessionRepository: SessionRepository;
  auditRepository: AuditRepository;
  clock: Clock;
};

export function createEmailChangeService(deps: EmailChangeDeps) {
  const ttlMs = 10 * 60 * 1000;

  async function verifyReauth(userId: string, password: string | undefined, recentAuthOk: boolean): Promise<boolean> {
    const identity = await deps.identityRepository.findByUserAndProvider(userId, "EMAIL_PASSWORD");
    if (identity) {
      if (!password) return false;
      const credential = await deps.passwordCredentialRepository.findByIdentity(identity.id);
      if (!credential) return false;
      return verifyPassword(password, credential.passwordHash);
    }
    // Discord-only/passwordless users: require a recently authenticated session.
    return recentAuthOk;
  }

  return {
    async requestEmailChange(params: { userId: string; newEmail: string; currentPassword?: string; recentAuthOk?: boolean; requestId: string }): Promise<{ ok: true; acknowledgement: string; challengeToken?: string } | { ok: false; code: "REQUEST_FAILED" }> {
      const user = await deps.userRepository.findById(params.userId);
      if (!user || user.status !== "ACTIVE") return { ok: false, code: "REQUEST_FAILED" };
      if (!(await verifyReauth(user.id, params.currentPassword, params.recentAuthOk === true))) return { ok: false, code: "REQUEST_FAILED" };
      let normalizedNew: string;
      try { normalizedNew = normalizeAuthEmail(params.newEmail); } catch { return { ok: false, code: "REQUEST_FAILED" }; }
      if (normalizedNew === user.emailNormalized) return { ok: false, code: "REQUEST_FAILED" };
      const existing = await deps.userRepository.findByNormalizedEmail(normalizedNew);
      if (existing) {
        await deps.auditRepository.append({ eventType: "EMAIL_CHANGE_REQUESTED", outcome: "failure", requestId: params.requestId, actorUserId: user.id, subjectUserId: user.id, metadata: { reason: "email_unavailable" } });
        return { ok: true, acknowledgement: "Se for possível, enviaremos a confirmação para o novo email." };
      }
      await deps.emailChallengeRepository.invalidateOutstanding(normalizedNew, "CHANGE_EMAIL");
      const token = generateSecurityToken("email-change");
      await deps.emailChallengeRepository.create({
        userId: user.id,
        emailNormalized: normalizedNew,
        purpose: "CHANGE_EMAIL",
        tokenHash: digestSecurityToken(token, "email-change"),
        authVersion: user.authVersion,
        expiresAt: new Date(deps.clock.now().getTime() + ttlMs),
      });
      await deps.auditRepository.append({ eventType: "EMAIL_CHANGE_REQUESTED", outcome: "success", requestId: params.requestId, actorUserId: user.id, subjectUserId: user.id, metadata: {} });
      return { ok: true, acknowledgement: "Se for possível, enviaremos a confirmação para o novo email.", challengeToken: token };
    },

    async confirmEmailChange(params: { userId: string; email: string; challengeToken: string; currentPassword?: string; recentAuthOk?: boolean; requestId: string }): Promise<{ ok: true; userId: string } | { ok: false; code: "REQUEST_FAILED" }> {
      let normalizedNew: string;
      try { normalizedNew = normalizeAuthEmail(params.email); } catch { return { ok: false, code: "REQUEST_FAILED" }; }
      const challenge = await deps.emailChallengeRepository.consume(digestSecurityToken(params.challengeToken, "email-change"));
      if (!challenge) return { ok: false, code: "REQUEST_FAILED" };
      if (challenge.purpose !== "CHANGE_EMAIL" || challenge.emailNormalized !== normalizedNew || !challenge.userId || challenge.authVersion === null || challenge.expiresAt <= deps.clock.now()) {
        throw new RollbackRequiredError("REQUEST_FAILED", "INVALID_CHALLENGE");
      }
      const user = await deps.userRepository.findById(challenge.userId);
      if (!user || user.id !== params.userId || user.status !== "ACTIVE" || user.authVersion !== challenge.authVersion) {
        throw new RollbackRequiredError("REQUEST_FAILED", "INVALID_CHALLENGE");
      }
      if (!(await verifyReauth(user.id, params.currentPassword, params.recentAuthOk === true))) {
        throw new RollbackRequiredError("REQUEST_FAILED", "INVALID_CREDENTIALS");
      }
      const existing = await deps.userRepository.findByNormalizedEmail(normalizedNew);
      if (existing && existing.id !== user.id) throw new RollbackRequiredError("REQUEST_FAILED", "EMAIL_TAKEN");

      await deps.userRepository.updateEmail(user.id, normalizedNew, deps.clock.now());
      const passwordIdentity = await deps.identityRepository.findByUserAndProvider(user.id, "EMAIL_PASSWORD");
      if (passwordIdentity) await deps.identityRepository.updateProviderSubject(user.id, "EMAIL_PASSWORD", normalizedNew);

      const bumped = await deps.userRepository.bumpAuthVersion(user.id, user.authVersion);
      if (!bumped) throw new RollbackRequiredError("REQUEST_FAILED", "AUTH_VERSION_MISMATCH");
      await deps.sessionRepository.revokeAllForUser(user.id);
      await deps.emailChallengeRepository.invalidateOutstanding(normalizedNew, "CHANGE_EMAIL", challenge.tokenHash);
      if (user.emailNormalized) await deps.emailChallengeRepository.invalidateOutstanding(user.emailNormalized, "PASSWORD_RESET");
      await deps.auditRepository.append({ eventType: "EMAIL_CHANGED", outcome: "success", requestId: params.requestId, actorUserId: user.id, subjectUserId: user.id, metadata: {} });
      return { ok: true, userId: user.id };
    },
  };
}
