import "server-only";
import { getWorkersEnv } from "@/lib/auth-api/get-env";

/** Read the public widget key at request time, avoiding secret or build-time client leakage. */
export async function getTurnstileClientConfig(): Promise<{ enabled: boolean; siteKey: string }> {
  const env = await getWorkersEnv();
  return {
    enabled: env.TURNSTILE_ENABLED === "true",
    siteKey: env.TURNSTILE_SITE_KEY?.trim() ?? "",
  };
}
