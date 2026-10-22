import "server-only";
import { AuthRole, AUTH_ROLES, AuthPermission, AUTH_PERMISSIONS, hasPermission, isStaffRole } from "@/lib/auth/permissions";

export type AuthStatus = "ACTIVE" | "SUSPENDED" | "DELETED";
export type AuthProvider = "EMAIL_PASSWORD" | "DISCORD";
export type OAuthIntent = "LOGIN" | "LINK";
export type EmailChallengePurpose = "REGISTER" | "VERIFY_EMAIL" | "CHANGE_EMAIL" | "PASSWORD_RESET";
export type AuditValue = string | number | boolean;

export type AuthUser = {
  id: string;
  emailNormalized: string | null;
  emailVerifiedAt: Date | null;
  displayName: string;
  role: AuthRole;
  status: AuthStatus;
  authVersion: number;
  createdAt: Date;
  updatedAt: Date;
};

export type AuthIdentity = {
  id: string;
  userId: string;
  provider: AuthProvider;
  providerSubject: string;
  createdAt: Date;
  lastAuthenticatedAt: Date | null;
};

export type PasswordCredential = {
  identityId: string;
  passwordHash: string;
  changedAt: Date;
};

export type AuthSession = {
  id: string;
  userId: string;
  tokenHash: string;
  authVersion: number;
  createdAt: Date;
  lastSeenAt: Date;
  idleExpiresAt: Date;
  absoluteExpiresAt: Date;
  revokedAt: Date | null;
  revocationReason: string | null;
  authenticatedAt: Date;
  mfaVerifiedAt: Date | null;
};

export type AuthBrowserContext = {
  id: string;
  tokenHash: string;
  csrfTokenHash: string;
  expiresAt: Date;
  createdAt: Date;
};

export type OAuthTransaction = {
  id: string;
  stateHash: string;
  browserContextId: string;
  intent: OAuthIntent;
  linkUserId: string | null;
  initiatingSessionId: string | null;
  returnPath: string;
  expiresAt: Date;
  consumedAt: Date | null;
  createdAt: Date;
};

export type EmailChallenge = {
  id: string;
  userId: string | null;
  emailNormalized: string;
  purpose: EmailChallengePurpose;
  tokenHash: string;
  authVersion: number | null;
  expiresAt: Date;
  consumedAt: Date | null;
  createdAt: Date;
};

export type MinecraftIdentity = {
  id: string;
  userId: string;
  namespace: string;
  subject: string;
  lastKnownUsername: string | null;
  verifiedAt: Date;
  verificationMethod: string;
};

export type AuthAuditRecord = {
  eventType: string;
  outcome: string;
  requestId: string;
  metadata: Record<string, AuditValue>;
  actorUserId: string | null;
  subjectUserId: string | null;
};

export type SessionIssueParams = {
  userId: string;
  authVersion: number;
  rememberMe: boolean;
  isStaff: boolean;
};

export type SessionValidateParams = {
  token: string;
  requiredPermission?: AuthPermission;
  requireRecentAuth?: boolean;
  requireMfa?: boolean;
};

export type LoginOutcome = {
  ok: true;
  session: AuthSession;
  user: AuthUser;
  rawToken: string;
} | {
  ok: false;
  code: "LOGIN_FAILED";
};

export type ResetOutcome = {
  ok: true;
  userId: string;
} | {
  ok: false;
  code: "RESET_FAILED";
};

export type RegisterOutcome = {
  ok: true;
  userId: string;
} | {
  ok: false;
  code: "REGISTER_FAILED";
};

export type SessionIssueResult = {
  ok: true;
  session: AuthSession;
  rawToken: string;
};

export type SessionValidateResult = {
  ok: true;
  session: AuthSession;
  user: AuthUser;
} | {
  ok: false;
  code: SessionValidateFailureCode;
};

export type SessionValidateFailureCode =
  | "INVALID_TOKEN" | "SESSION_NOT_FOUND" | "SESSION_REVOKED"
  | "SESSION_IDLE_EXPIRED" | "SESSION_ABSOLUTE_EXPIRED"
  | "USER_NOT_FOUND" | "USER_NOT_ACTIVE" | "AUTH_VERSION_MISMATCH"
  | "INSUFFICIENT_PERMISSION" | "RECENT_AUTH_REQUIRED" | "MFA_REQUIRED";

export type { AuthRole, AuthPermission };
export { AUTH_ROLES, AUTH_PERMISSIONS, hasPermission, isStaffRole };
