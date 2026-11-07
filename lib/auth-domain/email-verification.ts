import "server-only";
import { hashPassword, isPasswordPolicyValid } from "@/lib/auth/password";
import { normalizeAuthEmail } from "@/lib/auth/email";
import { digestSecurityToken } from "@/lib/auth/tokens";
import type { UserRepository, IdentityRepository, PasswordCredentialRepository, EmailChallengeRepository, AuditRepository } from "./repositories";
import type { Clock } from "./clock";

export class EmailVerificationError extends Error {
  constructor() { super("VERIFICATION_FAILED"); this.name = "EmailVerificationError"; }
}
export interface EmailVerificationDeps {
  userRepository: UserRepository;
  identityRepository: IdentityRepository;
  passwordCredentialRepository: PasswordCredentialRepository;
  emailChallengeRepository: EmailChallengeRepository;
  auditRepository: AuditRepository;
  clock: Clock;
}
type Outcome = { ok: true; userId: string } | { ok: false; code: "VERIFICATION_FAILED" };
type VerificationInput = { email: string; challengeToken: string; requestId: string };
export interface EmailVerificationService {
  completeRegistration(params: VerificationInput & { password: string; displayName: string }): Promise<Outcome>;
  verifyEmail(params: VerificationInput): Promise<Outcome>;
}

/** Requires transaction-scoped repositories; post-consumption failures must escape the transaction. */
export function createEmailVerificationService(deps: EmailVerificationDeps): EmailVerificationService {
  const { userRepository, identityRepository, passwordCredentialRepository, emailChallengeRepository, clock } = deps;
  async function consume(email: string, token: string) {
    const challenge = await emailChallengeRepository.consume(digestSecurityToken(token, "email-register"));
    if (!challenge) return null;
    if (challenge.purpose !== "REGISTER" || challenge.emailNormalized !== email || challenge.expiresAt <= clock.now()) {
      throw new EmailVerificationError();
    }
    return challenge;
  }
  return {
    async completeRegistration({ email, password, displayName, challengeToken, requestId }) {
      const normalized = normalizeAuthEmail(email);
      if (!isPasswordPolicyValid(password)) return { ok: false, code: "VERIFICATION_FAILED" };
      const challenge = await consume(normalized, challengeToken);
      if (!challenge) return { ok: false, code: "VERIFICATION_FAILED" };
      if (challenge.userId !== null || challenge.authVersion !== null || await userRepository.findByNormalizedEmail(normalized)) {
        throw new EmailVerificationError();
      }
      const passwordHash = await hashPassword(password);
      const now = clock.now();
      const user = await userRepository.createUser({
        emailNormalized: normalized, displayName, role: "USER", status: "ACTIVE", authVersion: 1,
        emailVerifiedAt: now, createdAt: now, updatedAt: now,
      });
      const identity = await identityRepository.createIdentity({ userId: user.id, provider: "EMAIL_PASSWORD", providerSubject: normalized, createdAt: now });
      await passwordCredentialRepository.createPasswordHash(identity.id, passwordHash);
      await emailChallengeRepository.invalidateOutstanding(normalized, "REGISTER", challenge.tokenHash);
      await deps.auditRepository.append({ eventType: "REGISTRATION_COMPLETED", outcome: "success", requestId, actorUserId: null, subjectUserId: user.id, metadata: {} });
      return { ok: true, userId: user.id };
    },
    async verifyEmail({ email, challengeToken, requestId }) {
      const normalized = normalizeAuthEmail(email);
      const challenge = await consume(normalized, challengeToken);
      if (!challenge) return { ok: false, code: "VERIFICATION_FAILED" };
      const user = await userRepository.findByNormalizedEmail(normalized);
      if (!user || user.status !== "ACTIVE" || user.emailVerifiedAt || challenge.userId !== user.id || challenge.authVersion !== user.authVersion) {
        throw new EmailVerificationError();
      }
      await userRepository.updateEmailVerifiedAt(user.id, clock.now());
      await emailChallengeRepository.invalidateOutstanding(normalized, "REGISTER", challenge.tokenHash);
      await deps.auditRepository.append({ eventType: "EMAIL_VERIFIED", outcome: "success", requestId, actorUserId: null, subjectUserId: user.id, metadata: {} });
      return { ok: true, userId: user.id };
    },
  };
}
