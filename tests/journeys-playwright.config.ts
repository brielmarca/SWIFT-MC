import { defineConfig } from "@playwright/test";

if (!process.env.JOURNEY_APP) throw new Error("Run node scripts/test-journeys.mjs");
export default defineConfig({
  testDir: "./journeys",
  workers: 1,
  timeout: 90000,
  use: { baseURL: "https://127.0.0.1:3103", ignoreHTTPSErrors: true, trace: "retain-on-failure" },
  projects: [
    { name: "desktop", use: { viewport: { width: 1440, height: 900 } } },
    { name: "mobile", use: { viewport: { width: 390, height: 844 } } },
  ],
  webServer: {
    command: "node node_modules/next/dist/bin/next dev --webpack --hostname 127.0.0.1 --port 3103 --experimental-https --experimental-https-key key.pem --experimental-https-cert cert.pem",
    cwd: process.env.JOURNEY_APP,
    url: "https://127.0.0.1:3103/login",
    ignoreHTTPSErrors: true,
    reuseExistingServer: false,
    timeout: 120000,
  },
});
