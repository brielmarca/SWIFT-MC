import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./browser",
  testMatch: "auth-header.spec.ts",
  workers: 1,
  use: { baseURL: "http://127.0.0.1:3102", trace: "retain-on-failure" },
  projects: [
    { name: "desktop", use: { viewport: { width: 1440, height: 900 } } },
    { name: "mobile", use: { viewport: { width: 390, height: 844 } } },
  ],
  webServer: {
    command: "npm run dev -- --hostname 127.0.0.1 --port 3102",
    cwd: "..",
    url: "http://127.0.0.1:3102/header-test-fixture",
    reuseExistingServer: false,
    env: { MINECRAFT_HOST: "127.0.0.1", MINECRAFT_PORT: "1", MINECRAFT_DATA_API_URL: "", MINECRAFT_DATA_API_TOKEN: "" },
  },
});
