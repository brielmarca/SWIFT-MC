import assert from "node:assert/strict";
import test, { after } from "node:test";
import { createTestPrisma } from "./helpers";
import { POST } from "@/app/api/orders/route";
import { validateOrderInput } from "@/lib/orders/order-input";

const db = createTestPrisma()!;
after(() => db.$disconnect());

for (const input of [
  { rankSlug: "swift", minecraftUsername: "ValidPlayer", email: "player@example.com" },
  { rankSlug: "unknown-rank", minecraftUsername: "ValidPlayer", email: "player@example.com" },
  { rankSlug: "swift", minecraftUsername: "invalid username", email: "player@example.com" },
  { rankSlug: "swift", minecraftUsername: "ValidPlayer", email: "not-an-email" },
]) {
  test(`unauthenticated order input is rejected before persistence: ${JSON.stringify(input)}`, async () => {
    const response = await POST(new Request("https://swift.example/api/orders", {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(input),
    }));
    assert.equal(response.status, 401);
    assert.equal(await db.order.count({ where: { email: input.email } }), 0);
  });
}

test("priced catalog validates input without creating orders", async () => {
  const result = validateOrderInput({ rankSlug: "swift", minecraftUsername: "ValidPlayer", email: "player@example.com" });
  assert.ok("data" in result);
  assert.equal(await db.order.count({ where: { email: "player@example.com" } }), 0);
});
