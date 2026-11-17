import "server-only";
import { getPrisma } from "@/lib/prisma";
import { generateTotpSecret, encryptMfaSecret, decryptMfaSecret, otpauthUri, verifyTotpAtStep, generateRecoveryCodes, hashRecoveryCode, generateMfaChallengeToken, digestMfaChallengeToken } from "@/lib/auth/mfa";
import { buildAuthAuditRecord } from "@/lib/auth-domain/audit";

type Env = { AUTH_ENCRYPTION_KEY?: string; APP_URL?: string };
const SETUP_TTL_MS = 10 * 60 * 1000;
const CHALLENGE_TTL_MS = 5 * 60 * 1000;
const MAX_CHALLENGE_ATTEMPTS = 5;

type AuditCreate = Parameters<Awaited<ReturnType<typeof getPrisma>>["authAuditEvent"]["create"]>[0]["data"];

export type MfaPurpose = "LOGIN" | "ELEVATION" | "DISABLE";

function now() { return new Date(); }
function err(code: string) { return { ok: false as const, code }; }

export function isPrivilegedRole(role: string) { return role === "ADMIN" || role === "OWNER"; }

export async function getMfaState(userId: string) {
  const prisma = getPrisma();
  const [cred, setup, codes] = await Promise.all([
    prisma.mfaCredential.findUnique({ where: { userId }, select: { id: true, enabledAt: true, confirmedAt: true, lastUsedStep: true } }),
    prisma.mfaSetup.findUnique({ where: { userId }, select: { id: true, expiresAt: true, consumedAt: true } }),
    prisma.mfaRecoveryCode.count({ where: { userId, usedAt: null } }),
  ]);
  const enabled = !!cred && !!cred.confirmedAt;
  return { enabled, pending: !!setup && !setup.consumedAt && setup.expiresAt > now(), recoveryCodesRemaining: codes, credentialId: cred?.id ?? null };
}

async function resolveMfaIdentityId(tx: Pick<Awaited<ReturnType<typeof getPrisma>>, "authIdentity">, userId: string): Promise<string | null> {
  // MFA credential is per-user; link to any identity owned by the same account (EMAIL_PASSWORD or DISCORD)
  // to satisfy integrity while keeping MFA provider-agnostic for all supported auth methods.
  const identities = await tx.authIdentity.findMany({ where: { userId }, select: { id: true, provider: true, createdAt: true } });
  if (identities.length === 0) return null;
  const preferred = identities.find((i) => i.provider === "EMAIL_PASSWORD")
    ?? identities.find((i) => i.provider === "DISCORD")
    ?? identities.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())[0];
  return preferred?.id ?? null;
}

export async function startMfaSetup(params: { env: Env; userId: string; accountLabel: string; requestId: string }) {
  const prisma = getPrisma();
  const user = await prisma.user.findUnique({ where: { id: params.userId }, select: { id: true, status: true } });
  if (!user || user.status !== "ACTIVE") return err("UNAVAILABLE");
  const existing = await prisma.mfaCredential.findUnique({ where: { userId: params.userId }, select: { confirmedAt: true } });
  if (existing?.confirmedAt) return err("ALREADY_ENABLED");
  const hasIdentity = await prisma.authIdentity.findFirst({ where: { userId: params.userId }, select: { id: true } });
  if (!hasIdentity) return err("IDENTITY_REQUIRED");
  if (!params.env.AUTH_ENCRYPTION_KEY) return err("UNAVAILABLE");
  const secret = generateTotpSecret();
  const ciphertext = encryptMfaSecret(params.env, secret);
  const expiresAt = new Date(Date.now() + SETUP_TTL_MS);
  await prisma.$transaction(async (tx) => {
    await tx.mfaSetup.upsert({
      where: { userId: params.userId },
      create: { userId: params.userId, secretCiphertext: ciphertext, expiresAt },
      update: { secretCiphertext: ciphertext, expiresAt, consumedAt: null, createdAt: now() },
    });
    await tx.authAuditEvent.create({ data: buildAuthAuditRecord({ eventType: "MFA_SETUP_STARTED", outcome: "success", requestId: params.requestId, actorUserId: params.userId, subjectUserId: params.userId }) as AuditCreate });
  });
  return { ok: true as const, otpauthUri: otpauthUri(secret, params.accountLabel || "account"), expiresAt };
}

export async function confirmMfaSetup(params: { env: Env; userId: string; code: string; requestId: string }) {
  const prisma = getPrisma();
  if (!params.env.AUTH_ENCRYPTION_KEY) return err("UNAVAILABLE");
  return prisma.$transaction(async (tx) => {
    const setup = await tx.mfaSetup.findUnique({ where: { userId: params.userId } });
    if (!setup || setup.consumedAt || setup.expiresAt <= now()) return err("SETUP_EXPIRED");
    let secret: string;
    try { secret = decryptMfaSecret(params.env, setup.secretCiphertext); } catch { return err("UNAVAILABLE"); }
    const step = verifyTotpAtStep(secret, params.code, Date.now(), 1);
    if (step === null) {
      await tx.authAuditEvent.create({ data: buildAuthAuditRecord({ eventType: "MFA_CHALLENGE_FAILED", outcome: "failure", requestId: params.requestId, actorUserId: params.userId, subjectUserId: params.userId, metadata: { reason: "INVALID_CREDENTIALS", mfaPurpose: "CONFIRM" } }) as AuditCreate });
      return err("INVALID_CODE");
    }
    const identityId = await resolveMfaIdentityId(tx, params.userId);
    if (!identityId) return err("IDENTITY_REQUIRED");
    const consumed = await tx.mfaSetup.updateMany({ where: { id: setup.id, consumedAt: null, expiresAt: { gt: now() } }, data: { consumedAt: now() } });
    if (consumed.count !== 1) return err("SETUP_EXPIRED");
    const enabledAt = now();
    const existingCred = await tx.mfaCredential.findUnique({ where: { userId: params.userId } });
    if (existingCred) {
      await tx.mfaCredential.update({ where: { userId: params.userId }, data: { identityId, secretCiphertext: setup.secretCiphertext, enabledAt, confirmedAt: enabledAt, lastUsedStep: step, lastUsedAt: enabledAt, pendingSecretCiphertext: null, pendingCreatedAt: null } });
    } else {
      await tx.mfaCredential.create({ data: { userId: params.userId, identityId, secretCiphertext: setup.secretCiphertext, enabledAt, confirmedAt: enabledAt, lastUsedStep: step, lastUsedAt: enabledAt } });
    }
    const plainCodes = generateRecoveryCodes(10);
    await tx.mfaRecoveryCode.deleteMany({ where: { userId: params.userId } });
    await tx.mfaRecoveryCode.createMany({ data: plainCodes.map((c) => ({ userId: params.userId, codeHash: hashRecoveryCode(c) })) });
    await tx.authAuditEvent.create({ data: buildAuthAuditRecord({ eventType: "MFA_ENABLED", outcome: "success", requestId: params.requestId, actorUserId: params.userId, subjectUserId: params.userId }) as AuditCreate });
    return { ok: true as const, recoveryCodes: plainCodes };
  });
}

export async function regenerateMfaRecoveryCodes(params: { userId: string; requestId: string }) {
  const prisma = getPrisma();
  return prisma.$transaction(async (tx) => {
    const credential = await tx.mfaCredential.findUnique({ where: { userId: params.userId }, select: { confirmedAt: true } });
    if (!credential?.confirmedAt) return err("NOT_CONFIGURED");
    const plainCodes = generateRecoveryCodes(10);
    await tx.mfaRecoveryCode.deleteMany({ where: { userId: params.userId } });
    await tx.mfaRecoveryCode.createMany({ data: plainCodes.map((c) => ({ userId: params.userId, codeHash: hashRecoveryCode(c) })) });
    // Recovery material rotation is security-sensitive and auditable; reuse failure-resistant metadata policy.
    await tx.authAuditEvent.create({ data: buildAuthAuditRecord({ eventType: "MFA_RECOVERY_REGENERATED", outcome: "success", requestId: params.requestId, actorUserId: params.userId, subjectUserId: params.userId, metadata: { mfaPurpose: "RECOVERY" } }) as AuditCreate });
    return { ok: true as const, recoveryCodes: plainCodes };
  });
}

export async function issueMfaChallenge(params: { userId: string; sessionId?: string | null; purpose: MfaPurpose; requestId: string }) {
  const prisma = getPrisma();
  const token = generateMfaChallengeToken();
  const tokenHash = digestMfaChallengeToken(token);
  const expiresAt = new Date(Date.now() + CHALLENGE_TTL_MS);
  await prisma.$transaction(async (tx) => {
    await tx.mfaChallenge.updateMany({ where: { userId: params.userId, purpose: params.purpose, consumedAt: null, expiresAt: { gt: now() } }, data: { consumedAt: now() } });
    await tx.mfaChallenge.create({ data: { userId: params.userId, sessionId: params.sessionId ?? null, purpose: params.purpose, tokenHash, expiresAt, maxAttempts: MAX_CHALLENGE_ATTEMPTS } });
    await tx.authAuditEvent.create({ data: buildAuthAuditRecord({ eventType: "MFA_CHALLENGE_ISSUED", outcome: "success", requestId: params.requestId, actorUserId: params.userId, subjectUserId: params.userId, metadata: { mfaPurpose: params.purpose } }) as AuditCreate });
  });
  return { ok: true as const, challengeToken: token, expiresAt };
}

export async function verifyMfaChallenge(params: { env: Env; challengeToken: string; code?: string; recoveryCode?: string; purpose: MfaPurpose; requestId: string; userId?: string; expectedSessionId?: string | null }) {
  const prisma = getPrisma();
  if (!params.env.AUTH_ENCRYPTION_KEY) return err("UNAVAILABLE");
  return prisma.$transaction(async (tx) => {
    const tokenHash = digestMfaChallengeToken(params.challengeToken);
    const challenge = await tx.mfaChallenge.findUnique({ where: { tokenHash } });
    if (!challenge || challenge.consumedAt || challenge.expiresAt <= now() || challenge.purpose !== params.purpose) return err("INVALID_CHALLENGE");
    if (params.userId && challenge.userId !== params.userId) return err("INVALID_CHALLENGE");
    if (params.expectedSessionId && challenge.sessionId && challenge.sessionId !== params.expectedSessionId) return err("INVALID_CHALLENGE");
    const credential = await tx.mfaCredential.findUnique({ where: { userId: challenge.userId } });
    if (!credential || !credential.confirmedAt) return err("NOT_CONFIGURED");

    const bumped = await tx.mfaChallenge.updateMany({ where: { id: challenge.id, consumedAt: null, attemptCount: { lt: challenge.maxAttempts } }, data: { attemptCount: { increment: 1 } } });
    if (bumped.count !== 1) return err("EXPIRED");

    let usedRecovery = false;
    if (params.recoveryCode) {
      const codeHash = hashRecoveryCode(params.recoveryCode);
      const used = await tx.mfaRecoveryCode.updateMany({ where: { userId: challenge.userId, codeHash, usedAt: null }, data: { usedAt: now() } });
      if (used.count !== 1) {
        await tx.authAuditEvent.create({ data: buildAuthAuditRecord({ eventType: "MFA_CHALLENGE_FAILED", outcome: "failure", requestId: params.requestId, actorUserId: challenge.userId, subjectUserId: challenge.userId, metadata: { reason: "INVALID_CREDENTIALS", mfaPurpose: params.purpose } }) as AuditCreate });
        return err("INVALID_CODE");
      }
      usedRecovery = true;
    } else if (params.code) {
      let secret: string;
      try { secret = decryptMfaSecret(params.env, credential.secretCiphertext); } catch { return err("UNAVAILABLE"); }
      const matchedStep = verifyTotpAtStep(secret, params.code, Date.now(), 1);
      if (matchedStep === null) {
        await tx.authAuditEvent.create({ data: buildAuthAuditRecord({ eventType: "MFA_CHALLENGE_FAILED", outcome: "failure", requestId: params.requestId, actorUserId: challenge.userId, subjectUserId: challenge.userId, metadata: { reason: "INVALID_CREDENTIALS", mfaPurpose: params.purpose } }) as AuditCreate });
        return err("INVALID_CODE");
      }
      if (credential.lastUsedStep !== null && matchedStep <= (credential.lastUsedStep as unknown as bigint)) {
        await tx.authAuditEvent.create({ data: buildAuthAuditRecord({ eventType: "MFA_CHALLENGE_FAILED", outcome: "failure", requestId: params.requestId, actorUserId: challenge.userId, subjectUserId: challenge.userId, metadata: { reason: "REPLAY", mfaPurpose: params.purpose } }) as AuditCreate });
        return err("REPLAY");
      }
      const replayGuard = await tx.mfaCredential.updateMany({
        where: { id: credential.id, OR: [{ lastUsedStep: null }, { lastUsedStep: { lt: matchedStep } }] },
        data: { lastUsedStep: matchedStep, lastUsedAt: now() },
      });
      if (replayGuard.count !== 1) {
        await tx.authAuditEvent.create({ data: buildAuthAuditRecord({ eventType: "MFA_CHALLENGE_FAILED", outcome: "failure", requestId: params.requestId, actorUserId: challenge.userId, subjectUserId: challenge.userId, metadata: { reason: "CONCURRENT", mfaPurpose: params.purpose } }) as AuditCreate });
        return err("REPLAY");
      }
    } else {
      return err("INVALID_CODE");
    }

    const consumed = await tx.mfaChallenge.updateMany({ where: { id: challenge.id, consumedAt: null }, data: { consumedAt: now(), verifiedAt: now() } });
    if (consumed.count !== 1) return err("EXPIRED");

    const eventType = usedRecovery ? "MFA_RECOVERY_USED" : "MFA_CHALLENGE_VERIFIED";
    await tx.authAuditEvent.create({ data: buildAuthAuditRecord({ eventType, outcome: "success", requestId: params.requestId, actorUserId: challenge.userId, subjectUserId: challenge.userId, metadata: { mfaPurpose: params.purpose } }) as AuditCreate });
    return { ok: true as const, userId: challenge.userId, sessionId: challenge.sessionId, usedRecovery };
  });
}

export async function disableMfa(params: { userId: string; requestId: string }) {
  const prisma = getPrisma();
  await prisma.$transaction(async (tx) => {
    const existing = await tx.mfaCredential.findUnique({ where: { userId: params.userId }, select: { id: true } });
    await tx.mfaChallenge.deleteMany({ where: { userId: params.userId } });
    await tx.mfaRecoveryCode.deleteMany({ where: { userId: params.userId } });
    await tx.mfaSetup.deleteMany({ where: { userId: params.userId } });
    await tx.mfaCredential.deleteMany({ where: { userId: params.userId } });
    if (existing) {
      await tx.authAuditEvent.create({ data: buildAuthAuditRecord({ eventType: "MFA_DISABLED", outcome: "success", requestId: params.requestId, actorUserId: params.userId, subjectUserId: params.userId }) as AuditCreate });
    }
  });
  return { ok: true as const };
}
