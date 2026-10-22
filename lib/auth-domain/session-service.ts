import "server-only";
import {
  generateSessionToken, digestSessionToken, isValidToken,
} from "@/lib/auth/tokens";
import { SESSION_POLICY } from "@/lib/auth/session-policy";
import { hasPermission } from "@/lib/auth/permissions";
import {
  SessionIssueParams, SessionValidateParams,
  SessionIssueResult, SessionValidateResult, SessionValidateFailureCode,
} from "./types";
import { SessionRepository, UserRepository } from "./repositories";
import { Clock } from "./clock";

const INVALID_TOKEN: SessionValidateFailureCode = "INVALID_TOKEN";
const SESSION_NOT_FOUND: SessionValidateFailureCode = "SESSION_NOT_FOUND";
const SESSION_REVOKED: SessionValidateFailureCode = "SESSION_REVOKED";
const SESSION_IDLE_EXPIRED: SessionValidateFailureCode = "SESSION_IDLE_EXPIRED";
const SESSION_ABSOLUTE_EXPIRED: SessionValidateFailureCode = "SESSION_ABSOLUTE_EXPIRED";
const USER_NOT_FOUND: SessionValidateFailureCode = "USER_NOT_FOUND";
const USER_NOT_ACTIVE: SessionValidateFailureCode = "USER_NOT_ACTIVE";
const AUTH_VERSION_MISMATCH: SessionValidateFailureCode = "AUTH_VERSION_MISMATCH";

function computeExpiry(now: Date, params: { rememberMe: boolean; isStaff: boolean }) {
  const absoluteSeconds = params.rememberMe
    ? SESSION_POLICY.rememberMeAbsoluteSeconds
    : SESSION_POLICY.normalAbsoluteSeconds;
  const idleSeconds = params.isStaff
    ? SESSION_POLICY.staffInactivitySeconds
    : SESSION_POLICY.inactivitySeconds;
  return {
    absoluteExpiresAt: new Date(now.getTime() + absoluteSeconds * 1000),
    idleExpiresAt: new Date(now.getTime() + idleSeconds * 1000),
  };
}

export interface SessionServiceDeps {
  sessionRepository: SessionRepository;
  userRepository: UserRepository;
  clock: Clock;
}

export interface SessionService {
  issueSession(params: SessionIssueParams): Promise<SessionIssueResult>;
  validateSession(params: SessionValidateParams & { token: string }): Promise<SessionValidateResult>;
  revokeSession(sessionId: string): Promise<void>;
  revokeAllUserSessions(userId: string): Promise<void>;
}

export function createSessionService(deps: SessionServiceDeps): SessionService {
  const { sessionRepository, userRepository, clock } = deps;

  return {
    async issueSession(params) {
      const now = clock.now();
      const { absoluteExpiresAt, idleExpiresAt } = computeExpiry(now, {
        rememberMe: params.rememberMe,
        isStaff: params.isStaff,
      });

      // Fresh opaque 256-bit session token.
      const token = generateSessionToken();
      const tokenHash = digestSessionToken(token);

      const session = await sessionRepository.create({
        userId: params.userId,
        tokenHash,
        authVersion: params.authVersion,
        idleExpiresAt,
        absoluteExpiresAt,
      });

      // The raw token is returned only to the immediate caller (cookie setter).
      // It is never persisted, never logged, and never placed in audit metadata.
      return { ok: true, session, rawToken: token };
    },

    async validateSession({ token, requiredPermission, requireRecentAuth, requireMfa }) {
      // 1. token format
      if (!isValidToken(token)) {
        return { ok: false, code: INVALID_TOKEN };
      }

      const now = clock.now();
      const tokenHash = digestSessionToken(token);

      // 2-3. digest lookup + session exists
      const session = await sessionRepository.findByTokenDigest(tokenHash);
      if (!session) {
        return { ok: false, code: SESSION_NOT_FOUND };
      }

      // 4. never revive revoked sessions
      if (session.revokedAt !== null) {
        return { ok: false, code: SESSION_REVOKED };
      }

      // 5. idle expiry has not passed
      if (now >= session.idleExpiresAt) {
        return { ok: false, code: SESSION_IDLE_EXPIRED };
      }

      // 6. never extend absolute expiry; never revive expired sessions
      if (now >= session.absoluteExpiresAt) {
        return { ok: false, code: SESSION_ABSOLUTE_EXPIRED };
      }

      // 7. user exists
      const user = await userRepository.findById(session.userId);
      if (!user) {
        return { ok: false, code: USER_NOT_FOUND };
      }

      // 8. user.status is ACTIVE
      if (user.status !== "ACTIVE") {
        return { ok: false, code: USER_NOT_ACTIVE };
      }

      // 9. session.authVersion === user.authVersion (auth-version invalidation)
      if (session.authVersion !== user.authVersion) {
        return { ok: false, code: AUTH_VERSION_MISMATCH };
      }

      // 10. required permission if specified
      if (requiredPermission !== undefined && !hasPermission(user.role, requiredPermission)) {
        return { ok: false, code: "INSUFFICIENT_PERMISSION" as SessionValidateFailureCode };
      }

      // 11. recent-authentication requirement if specified
      if (requireRecentAuth) {
        const recentAuthMs = now.getTime() - session.authenticatedAt.getTime();
        if (recentAuthMs > SESSION_POLICY.recentAuthenticationSeconds * 1000) {
          return { ok: false, code: "RECENT_AUTH_REQUIRED" as SessionValidateFailureCode };
        }
      }

      // 12. future MFA assurance placeholder when explicitly required
      if (requireMfa) {
        if (session.mfaVerifiedAt === null) {
          return { ok: false, code: "MFA_REQUIRED" as SessionValidateFailureCode };
        }
        const mfaMs = now.getTime() - session.mfaVerifiedAt.getTime();
        if (mfaMs > SESSION_POLICY.recentAuthenticationSeconds * 1000) {
          return { ok: false, code: "MFA_REQUIRED" as SessionValidateFailureCode };
        }
      }

      // Touch lastSeen without extending absolute expiry and without weakening rules.
      // Only reached when the session is currently valid.
      await sessionRepository.touchLastSeen(session.id, now);

      return { ok: true, session, user };
    },

    async revokeSession(sessionId) {
      await sessionRepository.revoke(sessionId);
    },

    async revokeAllUserSessions(userId) {
      await sessionRepository.revokeAllForUser(userId);
    },
  };
}
