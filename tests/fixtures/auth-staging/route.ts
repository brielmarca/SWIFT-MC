import "server-only";
// @ts-expect-error Runtime module provided by workerd, absent from Node's type declarations.
import { env } from "cloudflare:workers";
import { runAuthDiagnostic } from "@/lib/auth-infrastructure/diagnostics";
import type { DiagnosticBindings } from "@/lib/auth-infrastructure/bindings";

export const dynamic = "force-dynamic";
export async function POST(request: Request) {
  return runAuthDiagnostic(request, env as DiagnosticBindings);
}
