import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/browser",
  workers: 1,
  use: { baseURL: "http://127.0.0.1:3100", trace: "retain-on-failure" },
  projects: [
    { name: "desktop", use: { viewport: { width: 1440, height: 900 } } },
    { name: "mobile", use: { viewport: { width: 390, height: 844 } } },
  ],
  webServer: {
    command: process.env.TEST_RUNTIME === "vinext"
      ? "npm run start:vinext -- --host 127.0.0.1 --port 3100"
      : "npm run start -- --port 3100",
    url: "http://127.0.0.1:3100",
    reuseExistingServer: false,
    // Next runtime fallback; browser route mocks also isolate vinext's build-time bindings.
    env: { MINECRAFT_HOST: "127.0.0.1", MINECRAFT_PORT: "1", MINECRAFT_DATA_API_URL: "", MINECRAFT_DATA_API_TOKEN: "" },
  },
});
