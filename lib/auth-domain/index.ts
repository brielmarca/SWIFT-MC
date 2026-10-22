import "server-only";

// Barrel export for the database-independent authentication domain layer.
// Type-only re-exports use `export type` (required by isolatedModules).

export type { Clock } from "./clock";
export { SystemClock } from "./clock";

export type {
  AuthUser, AuthIdentity, PasswordCredential, AuthSession, AuthBrowserContext,
  OAuthTransaction, EmailChallenge, MinecraftIdentity, AuthAuditRecord,
  AuthStatus, AuthProvider, OAuthIntent, EmailChallengePurpose, AuditValue,
  SessionIssueParams, SessionValidateParams, LoginOutcome, ResetOutcome, RegisterOutcome,
  SessionIssueResult, SessionValidateResult, SessionValidateFailureCode,
  AuthRole, AuthPermission,
} from "./types";
export { AUTH_ROLES, AUTH_PERMISSIONS, hasPermission, isStaffRole } from "./types";

export type {
  UserRepository, IdentityRepository, PasswordCredentialRepository, SessionRepository,
  BrowserContextRepository, OAuthTransactionRepository, EmailChallengeRepository, AuditRepository,
} from "./repositories";

export type { SessionServiceDeps, SessionService } from "./session-service";
export { createSessionService } from "./session-service";

export {
  AUTH_VERSION_EVENTS, authVersionEventReason, describeAuthVersionInvalidation,
} from "./auth-version";
export type { AuthVersionEvent, AuthVersionEventReason } from "./auth-version";

export type { PasswordLoginDeps, PasswordLoginService } from "./password-login";
export { createPasswordLoginService, publicLoginFailure, PUBLIC_EMAIL_CHALLENGE_ACK } from "./password-login";

export type { RegistrationDeps, RegistrationService } from "./registration";
export { createRegistrationService } from "./registration";

export type { PasswordResetDeps, PasswordResetService, ResetRequest, ResetCompleteRequest } from "./password-reset";
export { createPasswordResetService } from "./password-reset";

export type { OAuthDeps, OAuthService } from "./oauth";
export { createOAuthService } from "./oauth";

export type { LimiterPurpose } from "./rate-limit";
export { deriveLimiterKey, limiterKeyForEmail, limiterKeyForEmailAndIp, limiterKeyForUser, limiterKeyForChallenge } from "./rate-limit";

export type {
  LoginRequest, RegistrationRequest, RegistrationCompleteRequest, PasswordResetRequest,
  PasswordResetCompleteRequest, LogoutRequest,
} from "./dto";
export {
  LoginRequestSchema, RegistrationRequestSchema, RegistrationCompleteRequestSchema,
  PasswordResetRequestSchema, PasswordResetCompleteRequestSchema, LogoutRequestSchema,
  validateLogin, validateRegistration, validateRegistrationComplete, validatePasswordReset,
  validatePasswordResetComplete, validateLogout,
} from "./dto";

export type { AuthAuditEventType, AuthAuditOutcome } from "./audit";
export {
  AUTH_AUDIT_EVENTS, AUTH_AUDIT_OUTCOMES, assertAuthAuditEventType, assertAuthAuditOutcome, buildAuthAuditRecord,
} from "./audit";
