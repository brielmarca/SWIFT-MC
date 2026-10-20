import { copyFile, mkdir, rm } from "node:fs/promises";
import process from "node:process";
import { URL } from "node:url";

const target = new URL("../app/auth-infrastructure-probe/", import.meta.url);
if (process.argv[2] === "prepare") {
  await mkdir(new URL("[probe]/", target), { recursive: true });
  await copyFile(new URL("../tests/fixtures/auth-staging/route.ts", import.meta.url), new URL("[probe]/route.ts", target));
} else if (process.argv[2] === "clean") {
  await rm(target, { recursive: true, force: true });
} else {
  throw new Error("Expected prepare or clean");
}
