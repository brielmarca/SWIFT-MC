import "server-only";
import { normalizeAuthEmail } from "@/lib/auth/email";
import { generateSecurityToken, digestSecurityToken } from "@/lib/auth/tokens";
import type { RegisterOutcome } from "./types";
import { createEmailVerificationService, type EmailVerificationDeps } from "./email-verification";

export type RegistrationDeps = EmailVerificationDeps;
export interface RegistrationService {
  requestRegistration(params: { email: string; requestId: string }): Promise<{
    ok: true; acknowledgement: string; challengeToken?: string; existingAccount?: boolean;
  }>;
  completeRegistration(params: { email: string; password: string; displayName: string; challengeToken: string; requestId: string }): Promise<RegisterOutcome>;
}

/** Requires a transaction. Deliver mail only after commit. */
export function createRegistrationService(deps: RegistrationDeps): RegistrationService {
  return {
    async requestRegistration({ email, requestId }) {
      const normalized = normalizeAuthEmail(email);
      const existing = await deps.userRepository.findByNormalizedEmail(normalized);
      const acknowledgement = "Se for possível, enviaremos as instruções para o email informado.";
      if (existing && (existing.status !== "ACTIVE" || existing.emailVerifiedAt)) return { ok: true, acknowledgement };
      // Pending registrations store only a challenge, never a password.
      await deps.emailChallengeRepository.invalidateOutstanding(normalized, "REGISTER");
      const token = generateSecurityToken("email-register");
      await deps.emailChallengeRepository.create({
        userId: existing?.id ?? null, emailNormalized: normalized, purpose: "REGISTER",
        tokenHash: digestSecurityToken(token, "email-register"), authVersion: existing?.authVersion ?? null,
        expiresAt: new Date(deps.clock.now().getTime() + 10 * 60 * 1000),
      });
      await deps.auditRepository.append({ eventType: "REGISTRATION_REQUESTED", outcome: "success", requestId, actorUserId: null, subjectUserId: existing?.id ?? null, metadata: {} });
      return { ok: true, acknowledgement, challengeToken: token, existingAccount: !!existing };
    },
    async completeRegistration(params) {
      const result = await createEmailVerificationService(deps).completeRegistration(params);
      return result.ok ? result : { ok: false, code: "REGISTER_FAILED" };
    },
  };
}
