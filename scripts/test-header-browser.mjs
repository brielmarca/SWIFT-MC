import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import process from "node:process";

// Follow the existing auth-runtime fixture pattern: no test identities or
// endpoints remain in the application after this runner exits.
const fixture = "app/header-test-fixture";
if (existsSync(fixture)) throw new Error(`Refusing to overwrite ${fixture}`);
const nextEnv = readFileSync("next-env.d.ts");
mkdirSync(fixture);
try {
  copyFileSync("tests/fixtures/auth-header/page.tsx", `${fixture}/page.tsx`);
  const result = spawnSync("npx", ["playwright", "test", "--config", "tests/header-playwright.config.ts", "--reporter=list"], {
    stdio: "inherit", env: { ...process.env, HEADER_UI_FIXTURE: "1" },
  });
  if (result.error) throw result.error;
  process.exitCode = result.status ?? 1;
} finally {
  rmSync(fixture, { recursive: true, force: true });
  // Generated validators would otherwise keep importing the removed fixture.
  rmSync(".next/dev/types", { recursive: true, force: true });
  writeFileSync("next-env.d.ts", nextEnv);
}
