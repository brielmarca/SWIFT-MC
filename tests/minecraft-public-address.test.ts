import assert from "node:assert/strict";
import test from "node:test";
import { serverInfo } from "@/data/server-info";

test("Minecraft join address uses the official swiftmc.com hostname", () => {
  assert.equal(serverInfo.defaultHost, "swiftmc.com");
  assert.match(serverInfo.connectionSteps[2].description, /swiftmc\.com/);
  assert.doesNotMatch(serverInfo.connectionSteps[2].description, /swiftmc\.com\.br/);
});
