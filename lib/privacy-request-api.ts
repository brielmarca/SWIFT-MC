import { z } from "zod";

// Small, validated inputs; no arbitrary user IDs, statuses or payment effects.
export const ADMIN_PRIVACY_ACTIONS = ["START_REVIEW", "RETURN_TO_QUEUE", "COMPLETE", "REJECT"] as const;
export type AdminPrivacyAction = typeof ADMIN_PRIVACY_ACTIONS[number];

export const adminPrivacyActionSchema = z.object({
  action: z.enum(ADMIN_PRIVACY_ACTIONS),
  expectedStatus: z.enum(["OPEN", "IN_REVIEW"]),
  attested: z.literal(true).optional(),
}).strict().superRefine((input, ctx) => {
  const mustBeOpen = input.action === "START_REVIEW";
  if (mustBeOpen !== (input.expectedStatus === "OPEN"))
    ctx.addIssue({ code: "custom", message: "Invalid current state" });
  if (["COMPLETE", "REJECT"].includes(input.action) && input.attested !== true)
    ctx.addIssue({ code: "custom", message: "Human review attestation required" });
});

export const PRIVACY_ACTION_TARGETS = {
  START_REVIEW: "IN_REVIEW",
  RETURN_TO_QUEUE: "OPEN",
  COMPLETE: "CLOSED",
  REJECT: "REJECTED",
} as const;

export const PRIVACY_ACTION_AUDIT_EVENTS = {
  START_REVIEW: "PRIVACY_REQUEST_REVIEW_STARTED",
  RETURN_TO_QUEUE: "PRIVACY_REQUEST_REOPENED",
  COMPLETE: "PRIVACY_REQUEST_COMPLETED",
  REJECT: "PRIVACY_REQUEST_REJECTED",
} as const;

export function parseAdminPrivacyQuery(url: string): { page: number; status?: "OPEN" | "IN_REVIEW" | "CLOSED" | "REJECTED" } | null {
  try {
    const values = new URL(url).searchParams;
    for (const key of values.keys()) if (key !== "page" && key !== "status") return null;
    if (values.getAll("page").length > 1 || values.getAll("status").length > 1) return null;
    const rawPage = values.get("page") ?? "1";
    if (!/^[1-9][0-9]{0,4}$/.test(rawPage)) return null;
    const page = Number(rawPage);
    if (!Number.isSafeInteger(page) || page > 10_000) return null;
    const rawStatus = values.get("status");
    if (rawStatus !== null && !["OPEN", "IN_REVIEW", "CLOSED", "REJECTED"].includes(rawStatus)) return null;
    return { page, ...(rawStatus ? { status: rawStatus as "OPEN" | "IN_REVIEW" | "CLOSED" | "REJECTED" } : {}) };
  } catch { return null; }
}

/** Bounded read independent of untrusted Content-Length. Cancels oversized streams. */
export async function readPrivacyJson(request: Request, maxBytes = 2048): Promise<unknown> {
  const contentType = request.headers.get("content-type")?.split(";")[0]?.trim().toLowerCase();
  if (contentType !== "application/json") throw new TypeError("INVALID_CONTENT_TYPE");
  const declared = request.headers.get("content-length");
  if (declared !== null && (!/^[0-9]+$/.test(declared) || Number(declared) > maxBytes)) throw new RangeError("BODY_TOO_LARGE");
  if (!request.body) throw new TypeError("INVALID_BODY");
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxBytes) { await reader.cancel().catch(() => undefined); throw new RangeError("BODY_TOO_LARGE"); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const merged = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { merged.set(chunk, offset); offset += chunk.byteLength; }
  return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(merged));
}
