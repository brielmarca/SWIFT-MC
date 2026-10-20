import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import process from "node:process";

if (existsSync("app/runtime-feasibility")) throw new Error("Remove the previous generated fixture with auth-runtime-fixture.mjs clean first.");
function run(command, args, environment = {}) {
  const result = spawnSync(command, args, { stdio: "inherit", env: { ...process.env, ...environment } });
  if (result.error || result.status !== 0) throw new Error(`Phase A command failed: ${command} ${args.join(" ")}`);
}
try {
  run(process.execPath, ["scripts/auth-runtime-fixture.mjs", "prepare"]);
  run("npm", ["run", "build"]);
  run("npm", ["run", "test:browser", "--", "tests/browser/auth-runtime.spec.ts"], { AUTH_RUNTIME_PROBE: "1", TEST_RUNTIME: "next" });
  run(process.execPath, ["scripts/auth-runtime-fixture.mjs", "workers"]);
  run("npm", ["run", "build:vinext"]);
  run("npm", ["run", "test:browser", "--", "tests/browser/auth-runtime.spec.ts"], { AUTH_RUNTIME_PROBE: "1", TEST_RUNTIME: "vinext" });
  run(process.execPath, ["scripts/check-auth-public-assets.mjs"]);
} finally {
  run(process.execPath, ["scripts/auth-runtime-fixture.mjs", "clean"]);
  // Discard all probe-bearing outputs even after failure; nothing here is deployable.
  // The normal build commands recreate clean artifacts after this script exits.
  const { rmSync } = await import("node:fs");
  for (const path of [".next", ".cloudflare/output"]) rmSync(path, { recursive: true, force: true });
}
