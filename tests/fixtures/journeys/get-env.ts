import "server-only";
import { appendFileSync } from "node:fs";

// Installed ONLY in the disposable test copy by scripts/test-journeys.mjs.
const url = new URL(process.env.TEST_DATABASE_URL!);
if (url.hostname !== "localhost" || url.username !== "swiftmc_test" || url.pathname !== "/swiftmc_test" ||
    !/^\/tmp\/swiftmc-pg-test-[A-Za-z0-9]+$/.test(url.searchParams.get("host") ?? "") ||
    !process.env.JOURNEY_MAIL?.startsWith(`${url.searchParams.get("host")}/`)) throw new Error("Isolated journey environment required");

const state = globalThis as typeof globalThis & { journeyTransport?: boolean; journeyLimits?: Map<string, { count: number; until: number }> };
if (!state.journeyTransport) {
  const original = globalThis.fetch;
  globalThis.fetch = async (input, init) => {
    const target = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url);
    if (target.href === "https://api.resend.com/emails") {
      const mail = JSON.parse(String(init?.body));
      if (!mail.to.every((to: string) => to.endsWith("@journey.invalid"))) throw new Error("Non-test email blocked");
      appendFileSync(process.env.JOURNEY_MAIL!, `${JSON.stringify(mail)}\n`);
      return Response.json({ id: "isolated-mail" });
    }
    if (target.hostname !== "127.0.0.1" && target.hostname !== "localhost") throw new Error("External journey request blocked");
    return original(input, init);
  };
  state.journeyTransport = true;
}
state.journeyLimits ??= new Map();

export async function getWorkersEnv() {
  return {
    APP_URL: "https://127.0.0.1:3103",
    AUTH_HYPERDRIVE: { connectionString: process.env.TEST_DATABASE_URL! },
    AUTH_RATE_LIMIT: { async limit({ key }: { key: string }) {
      const now = Date.now();
      const entry = state.journeyLimits!.get(key);
      const current = entry && entry.until > now ? entry : { count: 0, until: now + 60000 };
      current.count++;
      state.journeyLimits!.set(key, current);
      return { success: current.count <= 10 };
    } },
    RESEND_API_KEY: "isolated-mail-only", EMAIL_FROM: "sender@journey.invalid",
  };
}
