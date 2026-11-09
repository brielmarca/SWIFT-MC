import assert from "node:assert/strict";
import test from "node:test";
import config from "../cloudflare.config";
import { bindings } from "cf/config";

test("Workers config emits allowlisted variables and secret declarations, never secret values", () => {
  const values = {
    MINECRAFT_HOST: "origin.example.com",
    MINECRAFT_PORT: "25566",
    MINECRAFT_PUBLIC_ADDRESS: "play.example.com",
    MINECRAFT_DATA_API_URL: "https://data.example.com/v1/",
    MINECRAFT_DATA_API_TOKEN: "private-canary-do-not-serialize",
    DATABASE_URL: "postgresql://private-canary-do-not-serialize@example.com/db",
  };
  const saved = Object.fromEntries(Object.keys(values).map((key) => [key, process.env[key]]));
  Object.assign(process.env, values);
  try {
    const worker = config({ mode: "production", isPreview: false }).worker;
    assert.equal(worker.name, "swift-mc");
    assert.equal(worker.compatibilityDate, "2026-10-07");
    assert.ok(worker.compatibilityFlags.includes("nodejs_compat"));
    assert.deepEqual(worker.env.NODE_ENV, { type: "text", value: "production" });
    assert.deepEqual(worker.env.MINECRAFT_HOST, { type: "text", value: values.MINECRAFT_HOST });
    assert.deepEqual(worker.env.MINECRAFT_DATA_API_TOKEN, { type: "secret" });
    assert.ok(!JSON.stringify(worker).includes("private-canary-do-not-serialize"));
    assert.ok(!("DATABASE_URL" in worker.env));
    process.env.MINECRAFT_DATA_API_URL = "";
    assert.ok(!("MINECRAFT_DATA_API_TOKEN" in config({ mode: "production", isPreview: false }).worker.env));
  } finally {
    for (const [key, value] of Object.entries(saved)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});

test("internal job secret is declared and fulfillment bindings stay optional", () => {
  const saved = process.env.MINECRAFT_FULFILLMENT_URL;
  try {
    delete process.env.MINECRAFT_FULFILLMENT_URL;
    let worker = config({ mode: "production", isPreview: false }).worker;
    assert.deepEqual(worker.env.INTERNAL_JOB_SECRET, { type: "secret" });
    assert.deepEqual(worker.env.MINECRAFT_FULFILLMENT_URL, { type: "text", value: "" });
    assert.ok(!("MINECRAFT_FULFILLMENT_TOKEN" in worker.env));
    assert.ok(!("DATABASE_URL" in worker.env));

    process.env.MINECRAFT_FULFILLMENT_URL = "https://fulfill.example.com/";
    worker = config({ mode: "production", isPreview: false }).worker;
    assert.deepEqual(worker.env.MINECRAFT_FULFILLMENT_URL, { type: "text", value: "https://fulfill.example.com/" });
    assert.deepEqual(worker.env.MINECRAFT_FULFILLMENT_TOKEN, { type: "secret" });
  } finally {
    if (saved === undefined) delete process.env.MINECRAFT_FULFILLMENT_URL;
    else process.env.MINECRAFT_FULFILLMENT_URL = saved;
  }
});

test("installed cf supports future auth binding declarations without provisioning resources", () => {
  assert.equal(typeof bindings.hyperdrive, "function");
  assert.equal(typeof bindings.rateLimit, "function");
  assert.equal(typeof bindings.durableObject, "function");
  for (const name of ["AUTH_RATE_LIMIT_KEY", "AUTH_ENCRYPTION_KEY", "DISCORD_CLIENT_SECRET"]) {
    assert.deepEqual({ [name]: bindings.secret() }, { [name]: { type: "secret" } });
    assert.ok(!(name in config({ mode: "production", isPreview: false }).worker.env));
  }
});
