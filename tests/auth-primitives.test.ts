import assert from "node:assert/strict";
import { test } from "node:test";
import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { hashPassword, verifyPassword, passwordHashNeedsUpgrade, PASSWORD_MAX_BYTES } from "../lib/auth/password";
import { generateSessionToken, isValidToken, digestSessionToken, generateSecurityToken, digestSecurityToken, tokenDigestsEqual, SECURITY_TOKEN_PURPOSES } from "../lib/auth/tokens";
import { normalizeAuthEmail } from "../lib/auth/email";
import { AUTH_ROLES, AUTH_PERMISSIONS, hasPermission, isStaffRole } from "../lib/auth/permissions";
import { serializeSessionCookie, serializeSessionCookieDeletion, setSessionCookie, clearSessionCookie } from "../lib/auth/cookies";
import { SESSION_POLICY } from "../lib/auth/session-policy";
import { internalReturnPath, hasExactOrigin, hasSafeFetchMetadata, hasTrustedBrowserMutation } from "../lib/auth/browser-security";
import { sanitizeAuthAuditMetadata } from "../lib/auth/audit-metadata";
import { PUBLIC_AUTH_ERRORS, publicLoginFailure } from "../lib/auth/errors";

test("scrypt roundtrip, random salts, exact whitespace and Unicode preservation", async () => {
  const password = "  synthetic-fixture-🔐-é  ";
  const hash = await hashPassword(password);
  assert.match(hash, /^\$swiftmc\$scrypt\$v=1\$N=32768,r=8,p=3\$[\w-]{22}\$[\w-]{43}$/);
  assert.equal(await verifyPassword(password, hash), true);
  for (const wrong of [password.trim(), "wrong", password.normalize("NFD")]) assert.equal(await verifyPassword(wrong, hash), false);
  assert.notEqual(await hashPassword(password), hash);
  assert.equal(passwordHashNeedsUpgrade(hash), false);
});

test("password boundaries and untrusted encoded parameters fail closed", async () => {
  const hash = await hashPassword("fixture");
  for (const malformed of ["", "x".repeat(1000), hash + "$extra", hash.replace("v=1", "v=2"), hash.replace("32768", "1073741824"), hash.replace("p=3", "p=1"), hash.replace(/.$/, "="), hash.replace(/\$[^$]+$/, "$short")]) {
    assert.equal(await verifyPassword("fixture", malformed), false);
    assert.equal(passwordHashNeedsUpgrade(malformed), true);
  }
  for (const password of ["", "x".repeat(PASSWORD_MAX_BYTES + 1), "🔐".repeat(257), "\ud800"]) {
    await assert.rejects(hashPassword(password), /Invalid password input/);
    assert.equal(await verifyPassword(password, hash), false);
  }
  const boundary = "x".repeat(PASSWORD_MAX_BYTES);
  assert.equal(await verifyPassword(boundary, await hashPassword(boundary)), true);
});

test("opaque tokens contain 32 random bytes with canonical encoding and domain-separated digests", () => {
  const tokens = Array.from({ length: 256 }, generateSessionToken);
  assert.equal(new Set(tokens).size, tokens.length); // Collision regression, not a statistical entropy proof.
  for (const token of tokens) {
    assert.equal(isValidToken(token), true);
    assert.equal(Buffer.from(token, "base64url").length, 32);
  }
  const token = tokens[0];
  const expected = createHash("sha256").update("swiftmc:auth:v1:session\0").update(Buffer.from(token, "base64url")).digest("hex");
  assert.equal(digestSessionToken(token), expected);
  assert.equal(tokenDigestsEqual(expected, digestSessionToken(token)), true);
  assert.equal(tokenDigestsEqual(expected, digestSessionToken(tokens[1])), false);
  assert.equal(tokenDigestsEqual(expected, "bad"), false);
  const digests = SECURITY_TOKEN_PURPOSES.map((purpose) => {
    assert.ok(isValidToken(generateSecurityToken(purpose)));
    return digestSecurityToken(token, purpose);
  });
  assert.equal(new Set([expected, ...digests]).size, SECURITY_TOKEN_PURPOSES.length + 1);
  for (const invalid of ["", token + "=", token + "x", "a".repeat(43), "!".repeat(43), "a\r\nb"]) {
    assert.equal(isValidToken(invalid), false);
    assert.throws(() => digestSessionToken(invalid));
  }
});

test("email normalization matches lowercase persistence policy without provider alias rewriting", () => {
  assert.equal(normalizeAuthEmail(" \tA.B+Tag@GMAIL.COM\n"), "a.b+tag@gmail.com");
  assert.notEqual(normalizeAuthEmail("a.b@gmail.com"), normalizeAuthEmail("ab@gmail.com"));
  assert.notEqual(normalizeAuthEmail("a+tag@gmail.com"), normalizeAuthEmail("a@gmail.com"));
  for (const invalid of ["", "a", "a@@example.com", "a b@example.com", "a..b@example.com", ".a@example.com", "a.@example.com", "a@-example.com", "a@example..com", "a@localhost", "a@例.com", '"a"@example.com', "a\r\n@example.com", "x".repeat(65) + "@example.com", "a@" + "x".repeat(64) + ".com", "a@" + ("x".repeat(63) + ".").repeat(4) + "com"]) assert.throws(() => normalizeAuthEmail(invalid));
});

test("full RBAC matrix is explicit and SUPPORT/MODERATOR are independent", () => {
  const expected = [
    [true, false, false, false, false, false, false, false, false],
    [true, true, true, false, false, false, false, false, false],
    [true, false, false, true, true, false, false, false, false],
    [true, true, true, true, true, true, true, false, false],
    [true, true, true, true, true, true, true, true, true],
  ];
  AUTH_ROLES.forEach((role, i) => AUTH_PERMISSIONS.forEach((permission, j) => assert.equal(hasPermission(role, permission), expected[i][j], `${role}: ${permission}`)));
  for (const rank of ["VIP", "VIP+", "MVP", "ELITE", "NEXUS", "owner", "toString", "__proto__", ""]) {
    for (const permission of AUTH_PERMISSIONS) assert.equal(hasPermission(rank, permission), false);
    assert.equal(isStaffRole(rank), false);
  }
  assert.equal(isStaffRole("USER"), false);
  for (const role of AUTH_ROLES.slice(1)) assert.equal(isStaffRole(role), true);
});

test("cookie set/delete preserve production attributes and other cookies with explicit expiry", () => {
  const now = new Date("2026-10-22T00:00:00Z");
  const expires = new Date(now.getTime() + 3600_000);
  const token = generateSessionToken();
  const cookie = serializeSessionCookie(token, expires, now);
  assert.ok(cookie.startsWith(`__Host-swiftmc_session=${token};`));
  for (const value of [cookie, serializeSessionCookieDeletion()]) {
    for (const attribute of ["Path=/", "HttpOnly", "Secure", "SameSite=Lax"]) assert.ok(value.includes(attribute));
    assert.equal(/domain=/i.test(value), false);
  }
  assert.ok(cookie.includes("Max-Age=3600"));
  assert.ok(cookie.includes("Expires=Thu, 22 Oct 2026 01:00:00 GMT"));
  assert.ok(serializeSessionCookieDeletion().includes("Max-Age=0; Expires=Thu, 01 Jan 1970"));
  const headers = new Headers({ "Set-Cookie": "other=preserved" });
  setSessionCookie(headers, token, expires, now);
  clearSessionCookie(headers);
  assert.equal(headers.getSetCookie().length, 3);
  for (const expiry of [now, new Date(0), new Date(NaN), new Date(now.getTime() + (SESSION_POLICY.rememberMeAbsoluteSeconds + 1) * 1000)]) assert.throws(() => serializeSessionCookie(token, expiry, now));
  assert.throws(() => serializeSessionCookie("injected; Domain=evil", expires, now));
  assert.ok(SESSION_POLICY.staffInactivitySeconds < SESSION_POLICY.inactivitySeconds);
  assert.ok(SESSION_POLICY.inactivitySeconds < SESSION_POLICY.normalAbsoluteSeconds);
});

test("internal redirects reject URL/parser/encoding attacks", () => {
  for (const attack of ["https://evil.test", "//evil.test", "javascript:alert(1)", "data:text/html,x", "/\\evil.test", "/%2fevil.test", "/%252fevil.test", "/%255cevil.test", "/%0aevil", "/\u0000", "/a/..//evil.test", "/%2e%2e//evil.test", " /account", "/%", "/%E0%A4", "/" + "x".repeat(2048)]) assert.equal(internalReturnPath(attack), null, attack);
  assert.equal(internalReturnPath("/account?tab=security#sessions"), "/account?tab=security#sessions");
  assert.equal(internalReturnPath("/a/../account"), "/account");
});

test("exact HTTPS origin and fetch metadata reject sibling, scheme, port and header confusion", () => {
  const trusted = "https://swiftmc.example:8443";
  for (const origin of ["null", "https://evil.test", "http://swiftmc.example:8443", "https://swiftmc.example", trusted + "/", trusted + "/@evil.test", "https://user@swiftmc.example:8443", trusted + ", https://evil.test", "https://sub.swiftmc.example:8443"]) assert.equal(hasExactOrigin(new Headers({ origin }), trusted), false);
  assert.equal(hasExactOrigin(new Headers({ host: "swiftmc.example:8443", "x-forwarded-host": "swiftmc.example:8443" }), trusted), false);
  assert.equal(hasExactOrigin(new Headers({ origin: "http://localhost" }), "http://localhost"), false);
  assert.equal(hasExactOrigin(new Headers({ origin: trusted }), trusted), true);
  for (const site of ["same-site", "cross-site", "none", "garbage"]) assert.equal(hasTrustedBrowserMutation(new Headers({ origin: trusted, "sec-fetch-site": site }), trusted), false);
  assert.equal(hasTrustedBrowserMutation(new Headers({ origin: trusted, "sec-fetch-site": "same-origin" }), trusted), true);
  assert.equal(hasTrustedBrowserMutation(new Headers({ origin: trusted }), trusted), true);
  assert.equal(hasTrustedBrowserMutation(new Headers({ "sec-fetch-site": "same-origin" }), trusted), false);
  assert.equal(hasSafeFetchMetadata(new Headers({ "sec-fetch-mode": "no-cors" })), false);
  assert.equal(hasSafeFetchMetadata(new Headers({ "sec-fetch-dest": "iframe" })), false);
});

test("audit metadata strips credentials, nested request bodies and secrets under innocuous keys", () => {
  const secret = generateSessionToken();
  const sanitized = sanitizeAuthAuditMetadata({ provider: "DISCORD", rememberMe: false, attemptCount: 2, password: "raw-password", passwordHash: "$scrypt$...", authorization: `Bearer ${secret}`, sessionToken: secret, csrf: secret, access_token: secret, refreshToken: secret, pkce: secret, body: { password: "raw" }, metadata: { secret }, reason: secret, role: "Bearer abc", message: "raw-password", toString: secret });
  assert.deepEqual(sanitized, { provider: "DISCORD", rememberMe: false, attemptCount: 2 });
  for (const invalid of [null, [], "x", 1, new Date()]) assert.throws(() => sanitizeAuthAuditMetadata(invalid));
  assert.throws(() => sanitizeAuthAuditMetadata(Object.fromEntries(Array.from({ length: 65 }, (_, i) => [`key${i}`, i]))));
  assert.throws(() => sanitizeAuthAuditMetadata({ get password() { throw new Error("getter must not execute"); } }), /Invalid audit metadata/);
  assert.deepEqual(sanitizeAuthAuditMetadata(JSON.parse('{"__proto__":{"admin":true},"requestBody":{"password":"raw"}}')), {});
  assert.deepEqual(sanitizeAuthAuditMetadata({ attemptCount: Infinity, provider: "x".repeat(10000) }), {});
});

test("public login failure exposes no internal distinctions", () => {
  assert.deepEqual(publicLoginFailure(), { code: "LOGIN_FAILED", message: "Email ou senha inválidos." });
  assert.ok(Object.isFrozen(PUBLIC_AUTH_ERRORS.LOGIN_FAILED));
});

test("every B0 module declares the server-only boundary", () => {
  const directory = new URL("../lib/auth/", import.meta.url);
  for (const file of readdirSync(directory)) {
    if (file.endsWith(".ts")) assert.match(readFileSync(new URL(file, directory), "utf8"), /^import "server-only";/);
  }
});
