import { spawnSync } from "node:child_process";
import { cpSync, mkdtempSync, mkdirSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import process from "node:process";

// A disposable copy keeps test bindings, mail capture, and HTTPS keys out of
// application sources and deployable build output. Never load application .env.
const root = resolve(".");
const directory = mkdtempSync("/tmp/swiftmc-pg-test-");
const app = join(directory, "app-copy");
const bin = process.env.PG_BIN;
const executable = name => bin ? join(bin, name) : name;
const url = `postgresql://swiftmc_test@localhost:5432/swiftmc_test?host=${encodeURIComponent(directory)}`;
const env = {
  PATH: process.env.PATH, HOME: process.env.HOME,
  LD_LIBRARY_PATH: process.env.PG_LIB,
  DATABASE_URL: url, DIRECT_DATABASE_URL: url, TEST_DATABASE_URL: url,
  SWIFTMC_TEST_DB_MODE: "local",
  JOURNEY_APP: app, JOURNEY_MAIL: join(directory, "mail.jsonl"),
  APP_URL: "https://127.0.0.1:3103", MINECRAFT_HOST: "127.0.0.1", MINECRAFT_PORT: "1",
  NEXT_TELEMETRY_DISABLED: "1",
};
function run(command, args, cwd = root) {
  const result = spawnSync(command, args, { cwd, env, stdio: "inherit" });
  if (result.error || result.status !== 0) throw new Error(`${command} failed (${result.status ?? "unavailable"})`);
}
let started = false;
try {
  run(executable("initdb"), ["-D", join(directory, "data"), "-U", "swiftmc_test", "--auth=trust", "--no-locale", "--encoding=UTF8"]);
  run(executable("pg_ctl"), ["-D", join(directory, "data"), "-l", join(directory, "postgres.log"), "-o", `-k ${directory} -c listen_addresses=''`, "-w", "start"]);
  started = true;
  run(executable("createdb"), ["-h", directory, "-U", "swiftmc_test", "swiftmc_test"]);
  const config = join(directory, "prisma.config.ts");
  writeFileSync(config, `export default { schema: ${JSON.stringify(join(root, "prisma/schema.prisma"))} };`);
  run(join(root, "node_modules/.bin/prisma"), ["migrate", "deploy", "--config", config]);
  mkdirSync(app);
  for (const path of ["app", "components", "data", "lib", "public", "middleware.ts", "next.config.ts", "next-env.d.ts", "tsconfig.json", "tailwind.config.ts", "postcss.config.mjs", "package.json"]) {
    cpSync(join(root, path), join(app, path), { recursive: true });
  }
  symlinkSync(join(root, "node_modules"), join(app, "node_modules"), "dir");
  cpSync("tests/fixtures/journeys/get-env.ts", join(app, "lib/auth-api/get-env.ts"));
  writeFileSync(env.JOURNEY_MAIL, "", { mode: 0o600 });
  run("openssl", ["req", "-x509", "-newkey", "rsa:2048", "-nodes", "-keyout", join(app, "key.pem"), "-out", join(app, "cert.pem"), "-days", "1", "-subj", "/CN=localhost", "-addext", "subjectAltName=IP:127.0.0.1,DNS:localhost"]);
  run(join(root, "node_modules/.bin/playwright"), ["test", "--config", "tests/journeys-playwright.config.ts", "--reporter=list"]);
} finally {
  try {
    if (started) run(executable("pg_ctl"), ["-D", join(directory, "data"), "-m", "immediate", "-w", "stop"]);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}
