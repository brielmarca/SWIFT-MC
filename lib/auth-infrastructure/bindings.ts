import "server-only";

/** Structural capabilities, supplied by cloudflare:workers env, never process.env. */
export interface AuthBindings {
  AUTH_HYPERDRIVE?: { connectionString: string };
  AUTH_RATE_LIMIT?: { limit(input: { key: string }): Promise<{ success: boolean }> };
  AUTH_RATE_LIMIT_COORDINATOR?: {
    idFromName(name: string): unknown;
    get(id: unknown): { fetch(request: Request): Promise<Response> };
  };
  RESEND_API_KEY?: string;
  EMAIL_FROM?: string;
}

export interface DiagnosticBindings extends AuthBindings {
  AUTH_DIAGNOSTICS_ENABLED?: string;
  AUTH_DIAGNOSTICS_ENVIRONMENT?: string;
  AUTH_DIAGNOSTICS_TOKEN?: string;
}
