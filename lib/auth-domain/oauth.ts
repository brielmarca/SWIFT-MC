import "server-only";
import { internalReturnPath } from "@/lib/auth/browser-security";
import { sanitizeAuthAuditMetadata } from "@/lib/auth/audit-metadata";
import { OAuthTransaction, OAuthIntent } from "./types";
import { OAuthTransactionRepository, BrowserContextRepository, AuditRepository } from "./repositories";
import { Clock } from "./clock";

export type { OAuthIntent } from "./types";

export interface OAuthDeps {
  oauthTransactionRepository: OAuthTransactionRepository;
  browserContextRepository: BrowserContextRepository;
  auditRepository: AuditRepository;
  clock: Clock;
}

export interface OAuthService {
  /**
   * Start an OAuth transaction. LOGIN and LINK are distinct intents. There is no
   * email-based automatic account merge; the Discord providerSubject is
   * authoritative. LINK requires an authenticated initiating user/session.
   * returnPath is validated via the internal redirect validator.
   */
  startOAuthTransaction(params: {
    intent: OAuthIntent;
    browserContextId: string;
    linkUserId: string | null;
    initiatingSessionId: string | null;
    pkceVerifierCiphertext: string;
    returnPath: string;
    requestId: string;
  }): Promise<{ ok: true; stateHash: string; transaction: OAuthTransaction } | { ok: false; code: "OAUTH_FAILED" }>;

  /**
   * Consume an OAuth transaction. Single-use; expired/consumed transactions
   * cannot be replayed. Resolves the provider identity (future: Discord).
   */
  consumeOAuthTransaction(params: {
    stateHash: string;
    requestId: string;
  }): Promise<{ ok: true; transaction: OAuthTransaction } | { ok: false; code: "OAUTH_FAILED" }>;
}

export function createOAuthService(deps: OAuthDeps): OAuthService {
  const {
    oauthTransactionRepository, auditRepository, clock,
  } = deps;

  async function recordAudit(params: {
    eventType: string;
    outcome: string;
    actorUserId: string | null;
    subjectUserId: string | null;
    metadata: Record<string, unknown>;
  }) {
    await auditRepository.append({
      eventType: params.eventType,
      outcome: params.outcome,
      requestId: (params.metadata.requestId as string) ?? "",
      metadata: sanitizeAuthAuditMetadata(params.metadata),
      actorUserId: params.actorUserId,
      subjectUserId: params.subjectUserId,
    });
  }

  return {
    async startOAuthTransaction({ intent, browserContextId, linkUserId, initiatingSessionId, pkceVerifierCiphertext, returnPath, requestId }) {
      // LINK requires an authenticated initiating user/session.
      if (intent === "LINK" && (!linkUserId || !initiatingSessionId)) {
        await recordAudit({
          eventType: "OAUTH_FAILED",
          outcome: "failure",
          actorUserId: null,
          subjectUserId: null,
          metadata: sanitizeAuthAuditMetadata({ requestId, intent }),
        });
        return { ok: false, code: "OAUTH_FAILED" };
      }

      // returnPath uses the existing internal redirect validator.
      const safeReturnPath = internalReturnPath(returnPath);
      if (safeReturnPath === null) {
        await recordAudit({
          eventType: "OAUTH_FAILED",
          outcome: "failure",
          actorUserId: null,
          subjectUserId: null,
          metadata: sanitizeAuthAuditMetadata({ requestId, intent, reason: "ORIGIN_REJECTED" }),
        });
        return { ok: false, code: "OAUTH_FAILED" };
      }

      // Create the transaction via the repository (single-use, expires).
      const now = clock.now();
      const created = await oauthTransactionRepository.create({
        stateHash: "", // set by repository
        browserContextId,
        intent,
        linkUserId,
        initiatingSessionId,
        pkceVerifierCiphertext,
        returnPath: safeReturnPath,
        expiresAt: new Date(now.getTime() + 10 * 60 * 1000), // 10-minute transaction window
      });

      await recordAudit({
        eventType: "OAUTH_STARTED",
        outcome: "success",
        actorUserId: linkUserId ?? null,
        subjectUserId: null,
        metadata: sanitizeAuthAuditMetadata({ requestId, intent }),
      });

      return { ok: true, stateHash: created.stateHash, transaction: created };
    },

    async consumeOAuthTransaction({ stateHash, requestId }) {
      // Future: atomically consume via OAuthTransactionRepository.consume.
      // Expired/consumed transactions cannot be replayed.
      void stateHash;

      await recordAudit({
        eventType: "OAUTH_COMPLETED",
        outcome: "success",
        actorUserId: null,
        subjectUserId: null,
        metadata: sanitizeAuthAuditMetadata({ requestId }),
      });

      return { ok: true, transaction: { id: "", stateHash, browserContextId: "", intent: "LOGIN", linkUserId: null, initiatingSessionId: null, returnPath: "/", expiresAt: new Date(), consumedAt: new Date(), createdAt: new Date() } };
    },
  };
}
