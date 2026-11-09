import assert from "node:assert/strict";
import test from "node:test";
import { createEmailService, EmailService, ResendEmailProvider } from "@/lib/auth/email-service";

// ---------------------------------------------------------------------------
// ResendEmailProvider
// ---------------------------------------------------------------------------

test("ResendEmailProvider sends verification email via fetch", async (t) => {
  let capturedBody: string | null = null;
  t.mock.method(globalThis, "fetch", async (url: string, init: RequestInit) => {
    capturedBody = init.body as string;
    return new Response(JSON.stringify({ id: "email_1" }), { status: 200 });
  });

  const provider = new ResendEmailProvider({ apiKey: "re_test_key", fromEmail: "noreply@example.com" });
  await provider.sendVerificationEmail({
    to: "user@example.com",
    token: "challenge-token-abc",
    appUrl: "https://swiftmc.example",
  });

  assert.ok(capturedBody);
  const parsed = JSON.parse(capturedBody!);
  assert.equal(parsed.to[0], "user@example.com");
  assert.equal(parsed.from, "noreply@example.com");
  assert.ok(parsed.subject.includes("Verify"));
  assert.ok(parsed.html.includes("/verify-email"));
  assert.ok(parsed.html.includes("challenge-token-abc"));
});

test("ResendEmailProvider sends password reset email via fetch", async (t) => {
  let capturedBody: string | null = null;
  t.mock.method(globalThis, "fetch", async (url: string, init: RequestInit) => {
    capturedBody = init.body as string;
    return new Response(JSON.stringify({ id: "email_2" }), { status: 200 });
  });

  const provider = new ResendEmailProvider({ apiKey: "re_test_key", fromEmail: "noreply@example.com" });
  await provider.sendPasswordResetEmail({
    to: "user@example.com",
    token: "reset-token-xyz",
    appUrl: "https://swiftmc.example",
  });

  const parsed = JSON.parse(capturedBody!);
  assert.equal(parsed.to[0], "user@example.com");
  assert.ok(parsed.subject.includes("Reset"));
  assert.ok(parsed.html.includes("/reset-password"));
  assert.ok(parsed.html.includes("reset-token-xyz"));
});

test("ResendEmailProvider throws on non-ok response", async (t) => {
  t.mock.method(globalThis, "fetch", async () => {
    return new Response(JSON.stringify({ message: "API error" }), { status: 401, statusText: "Unauthorized" });
  });

  const provider = new ResendEmailProvider({ apiKey: "bad-key", fromEmail: "noreply@example.com" });
  await assert.rejects(
    provider.sendVerificationEmail({ to: "user@example.com", token: "tok", appUrl: "https://example.com" }),
    /Resend API error: 401/
  );
});

// ---------------------------------------------------------------------------
// EmailService
// ---------------------------------------------------------------------------

test("EmailService delegates to provider", async () => {
  let called = false;
  const provider = {
    sendVerificationEmail: async () => { called = true; },
    sendPasswordResetEmail: async () => { called = true; },
  };
  const service = new EmailService({ provider, appUrl: "https://swiftmc.example", fromEmail: "noreply@example.com" });
  await service.sendVerificationEmail({ to: "a@example.com", token: "tok" });
  assert.equal(called, true);
});

// ---------------------------------------------------------------------------
// createEmailService factory
// ---------------------------------------------------------------------------

test("createEmailService returns null when RESEND_API_KEY missing", () => {
  const service = createEmailService({ APP_URL: "https://swiftmc.example" });
  assert.equal(service, null);
});

test("createEmailService returns null when APP_URL missing", () => {
  const service = createEmailService({ RESEND_API_KEY: "key" });
  assert.equal(service, null);
});

test("createEmailService returns null when APP_URL is invalid", () => {
  const service = createEmailService({ RESEND_API_KEY: "key", APP_URL: "not-a-url" });
  assert.equal(service, null);
});

test("createEmailService returns EmailService when config is valid", () => {
  const service = createEmailService({
    RESEND_API_KEY: "key",
    APP_URL: "https://swiftmc.example",
    EMAIL_FROM: "noreply@example.com",
  });
  assert.ok(service instanceof EmailService);
});
