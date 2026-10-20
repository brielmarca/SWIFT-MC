import { copyFile, mkdir, rm } from "node:fs/promises";
import { URL } from "node:url";
import process from "node:process";

// Generated routes are ignored and never part of a normal production build.
const target = new URL("../app/runtime-feasibility/", import.meta.url);
if (process.argv[2] === "prepare") {
  await mkdir(new URL("probe/", target), { recursive: true });
  await copyFile(new URL("../tests/fixtures/auth-runtime/route.ts", import.meta.url), new URL("probe/route.ts", target));
  await copyFile(new URL("../tests/fixtures/auth-runtime/page.tsx", import.meta.url), new URL("page.tsx", target));
} else if (process.argv[2] === "workers") {
  await mkdir(new URL("bindings/", target), { recursive: true });
  await copyFile(new URL("../tests/fixtures/auth-runtime/bindings.ts", import.meta.url), new URL("bindings/route.ts", target));
} else if (process.argv[2] === "clean") {
  await rm(target, { recursive: true, force: true });
} else {
  throw new Error("Expected prepare, workers or clean");
}
