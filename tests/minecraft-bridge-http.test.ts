import assert from "node:assert/strict";
import test from "node:test";
import { GET as pendingV1 } from "../app/v1/bridge/pending/route";
import { GET as pendingApi } from "../app/api/v1/bridge/pending/route";
import { POST as ackV1 } from "../app/v1/bridge/ack/route";
import { POST as linkV1 } from "../app/v1/bridge/link/route";
import { acknowledgeBridgeDelivery } from "../lib/minecraft-bridge/service";
import { verifyBridgeRequest } from "../lib/minecraft-bridge/auth";

const SECRET = "bridge_secret_abcdefghijklmnopqrstuvwxyz";
test("plugin contract route modules resolve at /v1/bridge/* and /api/v1/bridge/*", () => {
  for (const fn of [pendingV1, pendingApi, ackV1, linkV1]) assert.equal(typeof fn, "function");
});

test("bridge auth requires exact secret and server identity", () => {
  const bindings = { MINECRAFT_BRIDGE_SECRET: SECRET, MINECRAFT_BRIDGE_SERVER_ID: "swift-survival" };
  assert.doesNotThrow(() => verifyBridgeRequest(new Headers({ authorization: `Bearer ${SECRET}`, "x-swift-server": "swift-survival" }), bindings));
  assert.throws(() => verifyBridgeRequest(new Headers({ authorization: `Bearer wrong`, "x-swift-server": "swift-survival" }), bindings));
  assert.throws(() => verifyBridgeRequest(new Headers({ authorization: `Bearer ${SECRET}`, "x-swift-server": "other" }), bindings));
});

test("ACK: only confirmed duplicate becomes 409 duplicate; unrelated conflicts fail (no false ack)", async () => {
  let acked = false;
  const db = {
    bridgeDelivery: {
      updateMany: async () => ({ count: acked ? 0 : ((acked = true), 1) }),
      findUnique: async ({ where }: { where: { deliveryId: string } }) =>
        where.deliveryId === "vip_ok_1" ? { status: "ACKED", sequence: BigInt(1) } : { status: "SUPERSEDED", sequence: BigInt(1) },
    },
  };
  const first = await acknowledgeBridgeDelivery(db as never, { deliveryId: "vip_ok_1", sequence: 1, status: "completed", serverId: "swift-survival" });
  assert.equal(first.httpStatus, 200);
  const dup = await acknowledgeBridgeDelivery(db as never, { deliveryId: "vip_ok_1", sequence: 1, status: "completed", serverId: "swift-survival" });
  assert.equal(dup.httpStatus, 409);
  assert.equal(dup.duplicate, true);
  await assert.rejects(() => acknowledgeBridgeDelivery(db as never, { deliveryId: "vip_conflict_1", sequence: 1, status: "completed", serverId: "swift-survival" }), /sequência inválida|Delivery/i);
});
