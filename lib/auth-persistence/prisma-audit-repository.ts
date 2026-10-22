import "server-only";
import { PrismaClient } from "@prisma/client";
import { AuditRepository, type AuthAuditRecord } from "@/lib/auth-domain/repositories";
import { AUDIT_METADATA_MAX_BYTES } from "@/lib/auth/audit-metadata";

/** Opaque marker: metadata arriving here must already be sanitized. */
type SanitizedAuditMetadata = AuthAuditRecord["metadata"];

function assertSanitizedMetadata(metadata: unknown): asserts metadata is SanitizedAuditMetadata {
  if (metadata === null || typeof metadata !== "object" || Array.isArray(metadata)) {
    throw new TypeError("Audit metadata must be a non-null object");
  }
  if (Object.getPrototypeOf(metadata) !== Object.prototype && Object.getPrototypeOf(metadata) !== null) {
    throw new TypeError("Audit metadata must be a plain object");
  }
  for (const [key, value] of Object.entries(metadata)) {
    if (typeof value !== "string" && typeof value !== "number" && typeof value !== "boolean") {
      throw new TypeError(`Audit metadata value for "${key}" must be a primitive`);
    }
    if (/^(password|passwordHash|token|secret|csrf|body)$/i.test(key)) {
      throw new TypeError(`Audit metadata rejects secret field: ${key}`);
    }
  }
  const size = Buffer.byteLength(JSON.stringify(metadata), "utf8");
  if (size > AUDIT_METADATA_MAX_BYTES) throw new RangeError("Audit metadata too large");
}

export class PrismaAuditRepository implements AuditRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async append(record: AuthAuditRecord): Promise<void> {
    assertSanitizedMetadata(record.metadata);
    await this.prisma.authAuditEvent.create({
      data: {
        eventType: record.eventType,
        outcome: record.outcome,
        requestId: record.requestId,
        metadata: record.metadata,
        actorUserId: record.actorUserId,
        subjectUserId: record.subjectUserId,
      },
    });
  }
}
