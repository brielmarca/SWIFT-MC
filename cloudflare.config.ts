import { bindings, defineConfig, defineWorker } from "cf/config";
import { loadEnv } from "vite";

export default defineConfig(({ mode }) => {
  // Explicit allowlist: only non-secret configuration enters Build Output.
  // Runtime secrets are supplied by Cloudflare, never serialized from .env.
  const env = loadEnv(mode ?? "production", process.cwd(), [
    "MINECRAFT_HOST", "MINECRAFT_PORT", "MINECRAFT_PUBLIC_ADDRESS", "MINECRAFT_DATA_API_URL",
  ]);
  const dataApiUrl = env.MINECRAFT_DATA_API_URL?.trim() || "";
  return {
    worker: defineWorker({
      name: "swift-mc",
      entrypoint: "vinext/server/fetch-handler",
      compatibilityDate: "2026-10-07",
      compatibilityFlags: ["nodejs_compat"],
      assets: { notFoundHandling: "none" },
      env: {
        ASSETS: bindings.assets(),
        IMAGES: bindings.images(),
        NODE_ENV: bindings.text(mode === "development" ? "development" : "production"),
        MINECRAFT_HOST: bindings.text(env.MINECRAFT_HOST?.trim() || ""),
        MINECRAFT_PORT: bindings.text(env.MINECRAFT_PORT?.trim() || ""),
        MINECRAFT_PUBLIC_ADDRESS: bindings.text(env.MINECRAFT_PUBLIC_ADDRESS?.trim() || ""),
        MINECRAFT_DATA_API_URL: bindings.text(dataApiUrl),
        // The integration is optional. A configured URL requires a deployed secret.
        ...(dataApiUrl ? { MINECRAFT_DATA_API_TOKEN: bindings.secret() } : {}),
      },
    }),
  };
});
