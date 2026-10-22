import assert from "node:assert/strict";
import test from "node:test";
import {
  LoginRequestSchema, RegistrationRequestSchema, RegistrationCompleteRequestSchema,
  PasswordResetRequestSchema, PasswordResetCompleteRequestSchema, LogoutRequestSchema,
} from "@/lib/auth-domain/dto";

function checkReject(schema: unknown, input: unknown) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const result = (schema as any).safeParse(input);
  assert.equal(result.success, false, `expected rejection for ${JSON.stringify(input)}`);
}

function checkAccept(schema: unknown, input: unknown) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const result = (schema as any).safeParse(input);
  assert.equal(result.success, true, `expected acceptance for ${JSON.stringify(input)}`);
}

test("LoginRequest: valid input accepted", () => {
  checkAccept(LoginRequestSchema, { email: "a@example.com", password: "p", rememberMe: true });
  checkAccept(LoginRequestSchema, { email: "a@example.com", password: "p" });
});

test("LoginRequest: rejects unknown fields", () => {
  checkReject(LoginRequestSchema, { email: "a@example.com", password: "p", role: "ADMIN" });
  checkReject(LoginRequestSchema, { email: "a@example.com", password: "p", userId: "x" });
  checkReject(LoginRequestSchema, { email: "a@example.com", password: "p", authVersion: 5 });
});

test("LoginRequest: rejects missing/bounded fields", () => {
  checkReject(LoginRequestSchema, { email: "", password: "p" });
  checkReject(LoginRequestSchema, { email: "a@example.com", password: "" });
  checkReject(LoginRequestSchema, { password: "p" });
  checkReject(LoginRequestSchema, { email: "a@example.com" });
});

test("RegistrationRequest: valid accepted, client-supplied role/status/rejected", () => {
  checkAccept(RegistrationRequestSchema, { email: "a@example.com", password: "p", displayName: "A" });
  checkReject(RegistrationRequestSchema, { email: "a@example.com", password: "p", displayName: "A", role: "ADMIN" });
  checkReject(RegistrationRequestSchema, { email: "a@example.com", password: "p", displayName: "A", status: "ACTIVE" });
  checkReject(RegistrationRequestSchema, { email: "a@example.com", password: "p", displayName: "A", authVersion: 1 });
});

test("RegistrationCompleteRequest: requires challenge token", () => {
  checkAccept(RegistrationCompleteRequestSchema, { email: "a@example.com", challengeToken: "tok", password: "p", displayName: "A" });
  checkReject(RegistrationCompleteRequestSchema, { email: "a@example.com", password: "p", displayName: "A" });
  checkReject(RegistrationCompleteRequestSchema, { email: "a@example.com", challengeToken: "tok", password: "p", displayName: "A", verified: true });
});

test("PasswordResetRequest: valid accepted", () => {
  checkAccept(PasswordResetRequestSchema, { email: "a@example.com" });
  checkReject(PasswordResetRequestSchema, { email: "" });
  checkReject(PasswordResetRequestSchema, {});
});

test("PasswordResetCompleteRequest: requires challenge token and new password", () => {
  checkAccept(PasswordResetCompleteRequestSchema, { email: "a@example.com", challengeToken: "tok", newPassword: "p" });
  checkReject(PasswordResetCompleteRequestSchema, { email: "a@example.com", newPassword: "p" });
  checkReject(PasswordResetCompleteRequestSchema, { email: "a@example.com", challengeToken: "tok" });
});

test("LogoutRequest: accepts empty object", () => {
  const result = LogoutRequestSchema.safeParse({});
  assert.equal(result.success, true);
});
