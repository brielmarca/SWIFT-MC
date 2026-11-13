import assert from "node:assert/strict";
import test, { beforeEach, mock } from "node:test";
import type { AuthBindings } from "@/lib/auth-infrastructure/bindings";

const ownerUser = { id: "owner1", emailNormalized: "owner@example.com", role: "OWNER", status: "ACTIVE", authVersion: 1, displayName: "Owner", createdAt: new Date(), emailVerifiedAt: new Date(), isMfaVerified: true, mfaVerifiedAt: new Date() };
void ({ id: "admin1", role: "ADMIN", displayName: "Admin" });
let currentUser = ownerUser;
let creates: unknown[] = [];
let audits: unknown[] = [];
let allowLimit = true;

const env: Partial<AuthBindings> & { APP_URL: string } = {
  APP_URL: "https://swiftmc.example",
  AUTH_HYPERDRIVE: { connectionString: "postgresql://unused.invalid/test" },
  AUTH_RATE_LIMIT: { async limit() { return { success: allowLimit }; } },
};
type MockPrisma = {
  provisionedAdmin: { findMany: () => Promise<unknown[]>; create: (args: unknown) => Promise<{ id: string }> };
  authAuditEvent: { create: (args: unknown) => Promise<{ id: string }> };
  $transaction: <T>(cb: (tx: MockPrisma) => Promise<T>) => Promise<T>;
};
const prisma: MockPrisma = {
  provisionedAdmin: {
    async findMany() { return []; },
    async create(args: unknown) { creates.push(args); return { id: "p1" }; },
  },
  authAuditEvent: { async create(args: unknown) { audits.push(args); return { id: "a1" }; } },
  $transaction: async <T>(cb: (tx: MockPrisma) => Promise<T>) => cb(prisma),
};
mock.module("@/lib/auth-api/get-env", { namedExports: { getWorkersEnv: async () => env } });
mock.module("@/lib/auth/middleware", { namedExports: {
  requireSession: async () => ({ user: currentUser, sessionId: "s1" }),
  requireCsrfToken: () => null,
} });
mock.module("@/lib/prisma", { namedExports: { getPrisma: () => prisma } });
const route = await import("@/app/api/admin/provisioned-admins/route");

beforeEach(() => { creates = []; audits = []; allowLimit = true; currentUser = ownerUser; });
function req(body?: object, overrides: Record<string, string> = {}) {
  return new Request("https://swiftmc.example/api/admin/provisioned-admins", {
    method: body ? "POST" : "GET",
    headers: { origin: "https://swiftmc.example", "content-type": "application/json", "sec-fetch-site": "same-origin", cookie: "__Host-swiftmc_csrf=x", "x-csrf-token": "x", ...overrides },
    body: body ? JSON.stringify(body) : undefined,
  });
}

test("provisioning rejects cross-origin and missing trusted origin", async () => {
  const r1 = await route.POST(req({ discordSubject: "123456789012345678" }, { origin: "https://evil.example" }));
  assert.equal(r1.status, 403);
  assert.equal(creates.length, 0);
});

test("OWNER can provision ADMIN allowlist entry with audit", async () => {
  const res = await route.POST(req({ discordSubject: "123456789012345678", targetRole: "ADMIN" }));
  assert.equal(res.status, 201);
  assert.equal(creates.length, 1);
  const data = (creates[0] as { data: Record<string, unknown> }).data;
  assert.equal(data.discordSubject, "123456789012345678");
  assert.equal(data.targetRole, "ADMIN");
  assert.equal(data.grantedByUserId, ownerUser.id);
  assert.ok(audits.length >= 1);
});

test("provisioning rejects attempt to create OWNER via API payload", async () => {
  const res = await route.POST(req({ discordSubject: "123456789012345678", targetRole: "OWNER" }));
  assert.ok(res.status === 400 || res.status === 403);
  assert.equal(creates.length, 0);
});

test("provisioning rejects invalid discord subject (email/display-name style blocked by format)", async () => {
  for (const bad of ["user@example.com", "Admin Name", "abc", ""]) {
    const res = await route.POST(req({ discordSubject: bad }));
    assert.equal(res.status, 400);
  }
  assert.equal(creates.length, 0);
});
