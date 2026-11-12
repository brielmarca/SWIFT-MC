import assert from "node:assert/strict";
import test from "node:test";
import { serverInfo } from "@/data/server-info";

test("Minecraft join address uses the official swiftmc.com.br hostname", () => {
  assert.equal(serverInfo.defaultHost, "swiftmc.com.br");
  assert.match(serverInfo.connectionSteps[2].description, /swiftmc\.com\.br/);
  assert.doesNotMatch(serverInfo.connectionSteps[2].description, /swiftmc\.com(?!\.br)/);
});
