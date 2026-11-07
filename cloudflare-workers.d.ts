declare module "cloudflare:workers" {
  export interface HyperdriveBinding {
    connectionString: string;
  }
  export interface RateLimitBinding {
    limit(input: { key: string }): Promise<{ success: boolean }>;
  }
  export interface DurableObjectNamespaceBinding {
    idFromName(name: string): unknown;
    get(id: unknown): { fetch(request: Request): Promise<Response> };
  }

  export interface Env {
    AUTH_HYPERDRIVE?: HyperdriveBinding;
    AUTH_RATE_LIMIT?: RateLimitBinding;
    AUTH_RATE_LIMIT_COORDINATOR?: DurableObjectNamespaceBinding;
    RESEND_API_KEY?: string;
    STRIPE_SECRET_KEY?: string;
    STRIPE_WEBHOOK_SECRET?: string;
    EMAIL_FROM?: string;
    AUTH_DIAGNOSTICS_ENABLED?: string;
    AUTH_DIAGNOSTICS_ENVIRONMENT?: string;
    AUTH_DIAGNOSTICS_TOKEN?: string;
    NODE_ENV: string;
    APP_URL: string;
    MINECRAFT_HOST: string;
    MINECRAFT_PORT: string;
    MINECRAFT_PUBLIC_ADDRESS: string;
    MINECRAFT_DATA_API_URL: string;
    [key: string]: unknown;
  }

  export const env: Env;
}
