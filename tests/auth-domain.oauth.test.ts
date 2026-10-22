import assert from "node:assert/strict";
import test from "node:test";
import { createOAuthService, type OAuthDeps } from "@/lib/auth-domain/oauth";
import {
  type OAuthTransactionRepository, type BrowserContextRepository, type AuditRepository,
  type OAuthTransaction, type AuthBrowserContext,
} from "@/lib/auth-domain/repositories";
import { Clock } from "@/lib/auth-domain/clock";

class FixedClock implements Clock {
  private nowValue: Date;
  constructor(start: string) { this.nowValue = new Date(start); }
  now(): Date { return new Date(this.nowValue.getTime()); }
}

class FakeOAuthTransactionRepository implements OAuthTransactionRepository {
  constructor(private readonly clock: FixedClock) {}
  transactions = new Map<string, OAuthTransaction>();
  async create(params: Parameters<OAuthTransactionRepository["create"]>[0]): Promise<OAuthTransaction> {
    const now = this.clock.now();
    const tx: OAuthTransaction = { id: "tx_1", stateHash: `state_${Math.random()}`, browserContextId: params.browserContextId, intent: params.intent, linkUserId: params.linkUserId, initiatingSessionId: params.initiatingSessionId, returnPath: params.returnPath, expiresAt: new Date(now.getTime() + 10 * 60 * 1000), consumedAt: null, createdAt: now };
    this.transactions.set(tx.stateHash, tx);
    return tx;
  }
  async consume(stateHash: string): Promise<OAuthTransaction | null> {
    const tx = this.transactions.get(stateHash);
    if (!tx || tx.consumedAt !== null || tx.expiresAt < this.clock.now()) return null;
    tx.consumedAt = this.clock.now();
    return tx;
  }
  async expire(): Promise<void> {}
}

class FakeBrowserContextRepository implements BrowserContextRepository {
  async create(_params: { tokenHash: string; csrfTokenHash: string; expiresAt: Date }): Promise<AuthBrowserContext> {
    return { id: "", tokenHash: _params.tokenHash, csrfTokenHash: _params.csrfTokenHash, expiresAt: _params.expiresAt, createdAt: new Date() };
  }
  async findByTokenHash(): Promise<AuthBrowserContext | null> { return null; }
  async consume(): Promise<AuthBrowserContext | null> { return null; }
  async expire(): Promise<void> {}
}

class FakeAuditRepository implements AuditRepository {
  events: Array<{ eventType: string; outcome: string }> = [];
  async append(record: { eventType: string; outcome: string; requestId: string; metadata: Record<string, unknown>; actorUserId: string | null; subjectUserId: string | null }): Promise<void> {
    this.events.push({ eventType: record.eventType, outcome: record.outcome });
  }
}

function makeService(deps: Partial<OAuthDeps> & { clock: FixedClock }) {
  return createOAuthService({
    oauthTransactionRepository: deps.oauthTransactionRepository ?? new FakeOAuthTransactionRepository(deps.clock),
    browserContextRepository: deps.browserContextRepository ?? new FakeBrowserContextRepository(),
    auditRepository: deps.auditRepository ?? new FakeAuditRepository(),
    clock: deps.clock,
  } as OAuthDeps);
}

test("OAuth LOGIN transaction starts with validated returnPath", async () => {
  const svc = makeService({ clock: new FixedClock("2026-10-22T00:00:00Z") });
  const result = await svc.startOAuthTransaction({
    intent: "LOGIN", browserContextId: "ctx_1", linkUserId: null, initiatingSessionId: null,
    pkceVerifierCiphertext: "ct", returnPath: "/account", requestId: "req_1",
  });
  assert.equal(result.ok, true);
  if (!result.ok) throw new Error("unreachable");
  assert.equal(result.transaction.returnPath, "/account");
  assert.equal(result.transaction.intent, "LOGIN");
});

test("OAuth LINK requires initiating identity/session", async () => {
  const svc = makeService({ clock: new FixedClock("2026-10-22T00:00:00Z") });
  const missingSession = await svc.startOAuthTransaction({
    intent: "LINK", browserContextId: "ctx_1", linkUserId: "user_1", initiatingSessionId: null,
    pkceVerifierCiphertext: "ct", returnPath: "/account", requestId: "req_1",
  });
  assert.equal(missingSession.ok, false);
  if (missingSession.ok) throw new Error("unreachable");
  assert.equal(missingSession.code, "OAUTH_FAILED");

  const missingUser = await svc.startOAuthTransaction({
    intent: "LINK", browserContextId: "ctx_1", linkUserId: null, initiatingSessionId: "sess_1",
    pkceVerifierCiphertext: "ct", returnPath: "/account", requestId: "req_1",
  });
  assert.equal(missingUser.ok, false);
  if (missingUser.ok) throw new Error("unreachable");
  assert.equal(missingUser.code, "OAUTH_FAILED");
});

test("OAuth rejects external returnPath", async () => {
  const svc = makeService({ clock: new FixedClock("2026-10-22T00:00:00Z") });
  const result = await svc.startOAuthTransaction({
    intent: "LOGIN", browserContextId: "ctx_1", linkUserId: null, initiatingSessionId: null,
    pkceVerifierCiphertext: "ct", returnPath: "https://evil.test", requestId: "req_1",
  });
  assert.equal(result.ok, false);
  if (result.ok) throw new Error("unreachable");
  assert.equal(result.code, "OAUTH_FAILED");
});

test("OAuth transaction is single-use: consumed and expired cannot replay", async () => {
  const clock = new FixedClock("2026-10-22T00:00:00Z");
  const repo = new FakeOAuthTransactionRepository(clock);
  const svc = makeService({ clock, oauthTransactionRepository: repo });
  const started = await svc.startOAuthTransaction({
    intent: "LOGIN", browserContextId: "ctx_1", linkUserId: null, initiatingSessionId: null,
    pkceVerifierCiphertext: "ct", returnPath: "/account", requestId: "req_1",
  });
  assert.equal(started.ok, true);
  if (!started.ok) throw new Error("unreachable");

  const first = await repo.consume(started.stateHash);
  assert.ok(first);
  const second = await repo.consume(started.stateHash);
  assert.equal(second, null, "consumed transaction cannot be replayed");
});

test("LOGIN and LINK are distinct intents", async () => {
  const svc = makeService({ clock: new FixedClock("2026-10-22T00:00:00Z") });
  const login = await svc.startOAuthTransaction({
    intent: "LOGIN", browserContextId: "ctx_1", linkUserId: null, initiatingSessionId: null,
    pkceVerifierCiphertext: "ct", returnPath: "/account", requestId: "req_1",
  });
  const link = await svc.startOAuthTransaction({
    intent: "LINK", browserContextId: "ctx_2", linkUserId: "user_1", initiatingSessionId: "sess_1",
    pkceVerifierCiphertext: "ct", returnPath: "/account", requestId: "req_2",
  });
  assert.equal(login.ok, true);
  assert.equal(link.ok, true);
  if (!login.ok || !link.ok) throw new Error("unreachable");
  assert.equal(login.transaction.intent, "LOGIN");
  assert.equal(link.transaction.intent, "LINK");
  assert.notEqual(link.transaction.linkUserId, login.transaction.linkUserId);
});
