import { bindings, defineConfig, defineWorker } from "cf/config";
import { loadEnv } from "vite";
import { existsSync } from "node:fs";

export default defineConfig(({ mode }) => {
  // Explicit allowlist: only non-secret configuration enters Build Output.
  // Runtime secrets are supplied by Cloudflare, never serialized from .env.
  const env = loadEnv(mode ?? "production", process.cwd(), [
    "MINECRAFT_HOST", "MINECRAFT_PORT", "MINECRAFT_PUBLIC_ADDRESS", "MINECRAFT_DATA_API_URL",
    "AUTH_HYPERDRIVE_ID", "APP_URL", "EMAIL_FROM", "MINECRAFT_FULFILLMENT_URL",
    "MINECRAFT_BRIDGE_SERVER_ID", "MINECRAFT_BRIDGE_ALLOWED_SERVER_IDS",
  ]);
  const dataApiUrl = env.MINECRAFT_DATA_API_URL?.trim() || "";
  const fulfillmentUrl = env.MINECRAFT_FULFILLMENT_URL?.trim() || "";
  const stagingDiagnostics = mode === "auth-staging";
  if (existsSync("app/auth-infrastructure-probe") && !stagingDiagnostics) {
    throw new Error("Remove staging diagnostic routes before a normal Worker build");
  }
  if (stagingDiagnostics && existsSync("app/runtime-feasibility")) {
    throw new Error("Local Phase A fixtures must not be deployed to staging");
  }
  return {
    worker: defineWorker({
      name: stagingDiagnostics ? "swift-mc-auth-staging" : "swift-mc",
      entrypoint: "vinext/server/fetch-handler",
      compatibilityDate: "2026-10-07",
      compatibilityFlags: ["nodejs_compat"],
      assets: { notFoundHandling: "none" },
      env: {
        ASSETS: bindings.assets(),
        IMAGES: bindings.images(),
        ...(env.AUTH_HYPERDRIVE_ID?.trim() ? {
          AUTH_HYPERDRIVE: bindings.hyperdrive({ id: env.AUTH_HYPERDRIVE_ID.trim() }),
        } : {}),
        AUTH_RATE_LIMIT: bindings.rateLimit({ namespace: "auth", simple: { limit: 10, period: 60 } }),
        ...(stagingDiagnostics ? {
          AUTH_DIAGNOSTICS_ENVIRONMENT: bindings.text("staging"),
          AUTH_DIAGNOSTICS_ENABLED: bindings.text("1"),
          AUTH_DIAGNOSTICS_TOKEN: bindings.secret(),
        } : {}),
        NODE_ENV: bindings.text(mode === "development" ? "development" : "production"),
        APP_URL: bindings.text(env.APP_URL?.trim() || ""),
        RESEND_API_KEY: bindings.secret(),
        STRIPE_SECRET_KEY: bindings.secret(),
        STRIPE_WEBHOOK_SECRET: bindings.secret(),
        EMAIL_FROM: bindings.text(env.EMAIL_FROM?.trim() || "noreply@swiftmc.com.br"),
        MINECRAFT_HOST: bindings.text(env.MINECRAFT_HOST?.trim() || ""),
        MINECRAFT_PORT: bindings.text(env.MINECRAFT_PORT?.trim() || ""),
        MINECRAFT_PUBLIC_ADDRESS: bindings.text(env.MINECRAFT_PUBLIC_ADDRESS?.trim() || ""),
        MINECRAFT_DATA_API_URL: bindings.text(dataApiUrl),
        // The integration is optional. A configured URL requires a deployed secret.
        ...(dataApiUrl ? { MINECRAFT_DATA_API_TOKEN: bindings.secret() } : {}),
        // Internal scheduler authentication for POST /api/internal/fulfillments/process.
        INTERNAL_JOB_SECRET: bindings.secret(),
        MINECRAFT_BRIDGE_SECRET: bindings.secret(),
        MINECRAFT_BRIDGE_SERVER_ID: bindings.text(env.MINECRAFT_BRIDGE_SERVER_ID?.trim() || "swift-survival"),
        MINECRAFT_BRIDGE_ALLOWED_SERVER_IDS: bindings.text(env.MINECRAFT_BRIDGE_ALLOWED_SERVER_IDS?.trim() || ""),
        // Optional legacy Minecraft fulfillment integration. A configured URL requires a deployed secret.
        MINECRAFT_FULFILLMENT_URL: bindings.text(fulfillmentUrl),
        ...(fulfillmentUrl ? { MINECRAFT_FULFILLMENT_TOKEN: bindings.secret() } : {}),
      },
    }),
  };
});
