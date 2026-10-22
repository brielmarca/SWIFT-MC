import "server-only";
import { z } from "zod";

const passwordSchema = z.string().min(1).max(1024);
const displayNameSchema = z.string().min(1).max(100);
const challengeTokenSchema = z.string().min(1).max(128);

/**
 * Strict validation schemas for future auth APIs.
 *
 * Rules enforced:
 *   - reject unknown fields (.strict())
 *   - bounded strings
 *   - no userId, role, status, authVersion, or verification flags supplied by client
 *   - no provider token supplied by client
 */

export const LoginRequestSchema = z.object({
  email: z.string().min(1).max(254),
  password: passwordSchema,
  rememberMe: z.boolean().optional(),
}).strict();

export type LoginRequest = z.infer<typeof LoginRequestSchema>;

export const RegistrationRequestSchema = z.object({
  email: z.string().min(1).max(254),
  password: passwordSchema,
  displayName: displayNameSchema,
}).strict();

export type RegistrationRequest = z.infer<typeof RegistrationRequestSchema>;

export const RegistrationCompleteRequestSchema = z.object({
  email: z.string().min(1).max(254),
  challengeToken: challengeTokenSchema,
  password: passwordSchema,
  displayName: displayNameSchema,
}).strict();

export type RegistrationCompleteRequest = z.infer<typeof RegistrationCompleteRequestSchema>;

export const PasswordResetRequestSchema = z.object({
  email: z.string().min(1).max(254),
}).strict();

export type PasswordResetRequest = z.infer<typeof PasswordResetRequestSchema>;

export const PasswordResetCompleteRequestSchema = z.object({
  email: z.string().min(1).max(254),
  challengeToken: challengeTokenSchema,
  newPassword: passwordSchema,
}).strict();

export type PasswordResetCompleteRequest = z.infer<typeof PasswordResetCompleteRequestSchema>;

export const LogoutRequestSchema = z.object({}).strict();

export type LogoutRequest = z.infer<typeof LogoutRequestSchema>;

export function validateLogin(input: unknown) {
  return LoginRequestSchema.safeParse(input);
}

export function validateRegistration(input: unknown) {
  return RegistrationRequestSchema.safeParse(input);
}

export function validateRegistrationComplete(input: unknown) {
  return RegistrationCompleteRequestSchema.safeParse(input);
}

export function validatePasswordReset(input: unknown) {
  return PasswordResetRequestSchema.safeParse(input);
}

export function validatePasswordResetComplete(input: unknown) {
  return PasswordResetCompleteRequestSchema.safeParse(input);
}

export function validateLogout(input: unknown) {
  return LogoutRequestSchema.safeParse(input);
}
