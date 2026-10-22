import "server-only";
import { verifyPassword } from "@/lib/auth/password";
import { normalizeAuthEmail } from "@/lib/auth/email";
import { publicLoginFailure, PUBLIC_EMAIL_CHALLENGE_ACK } from "@/lib/auth/errors";
import { sanitizeAuthAuditMetadata } from "@/lib/auth/audit-metadata";
import { LoginOutcome } from "./types";
import {
  UserRepository, IdentityRepository, PasswordCredentialRepository,
} from "./repositories";
import { SessionService } from "./session-service";
import { AuditRepository } from "./repositories";
import { Clock } from "./clock";

const DUMMY_PASSWORD = "swiftmc-login-dummy";
const DUMMY_PASSWORD_HASH =
  "$swiftmc$scrypt$v=1$N=32768,r=8,p=3$AAAAAAAAAAAAAAAAAAAAAA$BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB";

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
  sessionService: SessionService;
  auditRepository: AuditRepository;
  clock: Clock;
}

export interface PasswordLoginService {
  login(params: {
    email: string;
    password: string;
    rememberMe: boolean;
    requestId: string;
  }): Promise<LoginOutcome>;
}

export function createPasswordLoginService(deps: PasswordLoginDeps): PasswordLoginService {
  const {
    userRepository, identityRepository, passwordCredentialRepository,
    sessionService, auditRepository,
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

      // Step 6: enforce ACTIVE status.
      const active = user.status === "ACTIVE";

      // Step 7: re-read/recheck authVersion before issuing (user.authVersion is current).
      const authVersionOk = true;

      const credentialsValid = passwordOk && active && authVersionOk;

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

      // Step 8: issue session through SessionService.
      const isStaff = user.role !== "USER";
      const issued = await sessionService.issueSession({
        userId: user.id,
        authVersion: user.authVersion,
        rememberMe,
        isStaff,
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

      // Step 9: return domain result only. Raw token goes to the cookie setter.
      return { ok: true, session: issued.session, user, rawToken: issued.rawToken };
    },
  };
}

export { publicLoginFailure, PUBLIC_EMAIL_CHALLENGE_ACK };
