import "server-only";
import type { AuthBindings } from "@/lib/auth-infrastructure/bindings";

/**
 * Retrieves the Cloudflare Workers environment bindings.
 *
 * In the Workers runtime, `cloudflare:workers` provides the `env` object with
 * all declared bindings (text, secret, hyperdrive, etc.). During Next.js builds
 * or in non-Workers contexts, this module is unavailable; the function returns
 * an empty object so the build can complete. Routes that require a binding
 * (e.g. AUTH_HYPERDRIVE) return a 503 when it is absent.
 */
export async function getWorkersEnv(): Promise<Partial<AuthBindings> & { APP_URL?: string; DISCORD_CLIENT_ID?: string; DISCORD_CLIENT_SECRET?: string; DISCORD_REDIRECT_URI?: string; AUTH_ENCRYPTION_KEY?: string; AUTH_ADMIN_MFA_REQUIRED?: string }> {
  if (process.env.BACKEND_RUNTIME === "node") {
    const { getNodeAuthBindings } = await import("@/lib/auth-infrastructure/node-bindings");
    return getNodeAuthBindings();
  }
  try {
    // cloudflare:workers is a virtual module injected by @cloudflare/vite-plugin
    // in the Workers runtime. It is unavailable during `next build`, so the
    // dynamic import is wrapped to allow the Next.js build to complete.
    const mod = await import("cloudflare:workers");
    return (mod.env ?? {}) as Partial<AuthBindings> & { APP_URL?: string; DISCORD_CLIENT_ID?: string; DISCORD_CLIENT_SECRET?: string; DISCORD_REDIRECT_URI?: string; AUTH_ENCRYPTION_KEY?: string; AUTH_ADMIN_MFA_REQUIRED?: string };
  } catch {
    return {};
  }
}
