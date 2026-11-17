import "server-only";
import { internalReturnPath } from "@/lib/auth/browser-security";
import { sanitizeAuthAuditMetadata } from "@/lib/auth/audit-metadata";
import { generateSecurityToken, digestSecurityToken } from "@/lib/auth/tokens";
import { OAuthTransaction, OAuthIntent } from "./types";
import { OAuthTransactionRepository, AuditRepository } from "./repositories";
import { Clock } from "./clock";

export type { OAuthIntent } from "./types";

export interface OAuthDeps {
  oauthTransactionRepository: OAuthTransactionRepository;
  auditRepository: AuditRepository;
  clock: Clock;
}

export interface OAuthService {
  startOAuthTransaction(params: {
    intent: OAuthIntent;
    browserContextId: string;
    linkUserId: string | null;
    initiatingSessionId: string | null;
    pkceVerifierCiphertext: string;
    returnPath: string;
    requestId: string;
  }): Promise<{ ok: true; state: string; transaction: OAuthTransaction } | { ok: false; code: "OAUTH_FAILED" }>;
  consumeOAuthTransaction(params: {
    state: string;
    browserContextId: string;
    requestId: string;
  }): Promise<{ ok: true; transaction: OAuthTransaction } | { ok: false; code: "OAUTH_FAILED" }>;
}

export function createOAuthService(deps: OAuthDeps): OAuthService {
  const { oauthTransactionRepository, auditRepository, clock } = deps;

  async function recordAudit(params: { eventType: string; outcome: string; actorUserId: string | null; subjectUserId: string | null; metadata: Record<string, unknown> }) {
    await auditRepository.append({ eventType: params.eventType, outcome: params.outcome, requestId: (params.metadata.requestId as string) ?? "", metadata: sanitizeAuthAuditMetadata(params.metadata), actorUserId: params.actorUserId, subjectUserId: params.subjectUserId });
  }

  return {
    async startOAuthTransaction({ intent, browserContextId, linkUserId, initiatingSessionId, pkceVerifierCiphertext, returnPath, requestId }) {
      if (intent === "LINK" && (!linkUserId || !initiatingSessionId)) {
        await recordAudit({ eventType: "OAUTH_FAILED", outcome: "failure", actorUserId: null, subjectUserId: null, metadata: { requestId, intent } });
        return { ok: false, code: "OAUTH_FAILED" };
      }
      const safeReturnPath = internalReturnPath(returnPath);
      if (safeReturnPath === null) {
        await recordAudit({ eventType: "OAUTH_FAILED", outcome: "failure", actorUserId: null, subjectUserId: null, metadata: { requestId, intent, reason: "ORIGIN_REJECTED" } });
        return { ok: false, code: "OAUTH_FAILED" };
      }
      const state = generateSecurityToken("oauth-state");
      const now = clock.now();
      const created = await oauthTransactionRepository.create({
        stateHash: digestSecurityToken(state, "oauth-state"),
        browserContextId,
        intent,
        linkUserId,
        initiatingSessionId,
        pkceVerifierCiphertext,
        returnPath: safeReturnPath,
        expiresAt: new Date(now.getTime() + 10 * 60 * 1000),
      });
      await recordAudit({ eventType: "OAUTH_STARTED", outcome: "success", actorUserId: linkUserId ?? null, subjectUserId: null, metadata: { requestId, intent } });
      return { ok: true, state, transaction: created };
    },

    async consumeOAuthTransaction({ state, browserContextId, requestId }) {
      const tx = await oauthTransactionRepository.consume(digestSecurityToken(state, "oauth-state"));
      if (!tx || tx.browserContextId !== browserContextId) {
        await recordAudit({ eventType: "OAUTH_FAILED", outcome: "failure", actorUserId: null, subjectUserId: null, metadata: { requestId } });
        return { ok: false, code: "OAUTH_FAILED" };
      }
      await recordAudit({ eventType: "OAUTH_COMPLETED", outcome: "success", actorUserId: tx.linkUserId, subjectUserId: null, metadata: { requestId, intent: tx.intent } });
      return { ok: true, transaction: tx };
    },
  };
}
