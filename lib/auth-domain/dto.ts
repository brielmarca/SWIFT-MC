import "server-only";
import { z } from "zod";
import { PASSWORD_MIN_LENGTH } from "@/lib/auth/password";

const credentialSchema = z.string().min(1).max(1024);
const passwordSchema = z.string().min(PASSWORD_MIN_LENGTH).max(1024);
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
  password: credentialSchema,
  rememberMe: z.boolean().optional(),
}).strict();

export type LoginRequest = z.infer<typeof LoginRequestSchema>;

export const RegistrationRequestSchema = z.object({
  email: z.string().min(1).max(254),
  password: passwordSchema.optional(),
  displayName: displayNameSchema.optional(),
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


export const ProfileUpdateRequestSchema = z.object({
  displayName: displayNameSchema,
  phoneE164: z.union([z.string().min(8).max(20), z.null()]).optional(),
}).strict();

export const EmailChangeRequestSchema = z.object({
  currentPassword: credentialSchema.optional(),
  newEmail: z.string().min(1).max(254),
}).strict();

export const EmailChangeConfirmRequestSchema = z.object({
  email: z.string().min(1).max(254),
  challengeToken: challengeTokenSchema,
  currentPassword: credentialSchema.optional(),
}).strict();

export const MinecraftUnlinkRequestSchema = z.object({
  currentPassword: credentialSchema.optional(),
}).strict();

export const MinecraftCodeRequestSchema = z.object({}).strict();

export const DiscordUnlinkRequestSchema = z.object({
  currentPassword: credentialSchema.optional(),
}).strict();

export const PasswordChangeRequestSchema = z.object({
  currentPassword: credentialSchema,
  newPassword: passwordSchema,
}).strict();

export type PasswordChangeRequest = z.infer<typeof PasswordChangeRequestSchema>;

export const ResendVerificationRequestSchema = z.object({
  email: z.string().min(1).max(254),
}).strict();

export type ResendVerificationRequest = z.infer<typeof ResendVerificationRequestSchema>;

export const LogoutRequestSchema = z.object({}).strict();

export type LogoutRequest = z.infer<typeof LogoutRequestSchema>;

export function validateLogin(input: unknown) {
  return LoginRequestSchema.safeParse(input);
}

export function validateRegistration(input: unknown) {
  return RegistrationRequestSchema.safeParse(input);
}

export function validateRegistrationComplete(input: unknown) {
  return z.union([RegistrationCompleteRequestSchema, z.object({
    email: z.string().min(1).max(254),
    challengeToken: challengeTokenSchema,
  }).strict()]).safeParse(input);
}

export function validatePasswordReset(input: unknown) {
  return PasswordResetRequestSchema.safeParse(input);
}

export function validatePasswordResetComplete(input: unknown) {
  return PasswordResetCompleteRequestSchema.safeParse(input);
}

export function validateResendVerification(input: unknown) {
  return ResendVerificationRequestSchema.safeParse(input);
}

export function validateLogout(input: unknown) {
  return LogoutRequestSchema.safeParse(input);
}

export function validateProfileUpdate(input: unknown) { return ProfileUpdateRequestSchema.safeParse(input); }
export function validateEmailChangeRequest(input: unknown) { return EmailChangeRequestSchema.safeParse(input); }
export function validateEmailChangeConfirm(input: unknown) { return EmailChangeConfirmRequestSchema.safeParse(input); }
export function validateMinecraftUnlink(input: unknown) { return MinecraftUnlinkRequestSchema.safeParse(input); }
export function validateMinecraftCodeRequest(input: unknown) { return MinecraftCodeRequestSchema.safeParse(input); }
export function validateDiscordUnlink(input: unknown) { return DiscordUnlinkRequestSchema.safeParse(input); }

