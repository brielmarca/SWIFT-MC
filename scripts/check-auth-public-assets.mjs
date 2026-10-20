import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";

const forbidden = /AUTH_RATE_LIMIT_KEY|AUTH_ENCRYPTION_KEY|AUTH_DIAGNOSTICS_TOKEN|DIRECT_DATABASE_URL|DISCORD_CLIENT_SECRET|auth-feasibility\/crypto|scryptParameters|stagingScryptProbe/;
async function scan(directory) {
  let checked = 0;
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) checked += await scan(path);
    else {
      if (forbidden.test(await readFile(path, "utf8"))) throw new Error(`Server-only auth reference in public asset: ${path}`);
      checked++;
    }
  }
  return checked;
}
for (const directory of [".next/static", ".cloudflare/output/v0/workers/default/assets"]) {
  const checked = await scan(directory);
  // Counts only: never log matches or environment values.
  globalThis.console.log(`${directory}: ${checked} public assets checked`);
}
