import assert from "node:assert/strict";
import test from "node:test";
import { getEventPhase } from "../lib/event-display";

test("event display distinguishes upcoming, active and ended at exact boundaries", () => {
  const event = { startsAt: "2026-10-08T19:00:00-03:00", endsAt: "2026-10-08T22:00:00-03:00" };
  assert.equal(getEventPhase(event, Date.parse("2026-10-08T21:59:59Z")), "upcoming");
  assert.equal(getEventPhase(event, Date.parse("2026-10-08T22:00:00Z")), "active");
  assert.equal(getEventPhase(event, Date.parse("2026-10-09T00:59:59Z")), "active");
  assert.equal(getEventPhase(event, Date.parse("2026-10-09T01:00:00Z")), "ended");
});

test("event display never infers completion from absent or invalid end dates", () => {
  const startsAt = "2026-10-08T19:00:00-03:00";
  const now = Date.parse("2026-10-09T12:00:00Z");
  for (const endsAt of [undefined, "invalid", "2026-10-07T12:00:00Z"]) {
    assert.equal(getEventPhase({ startsAt, endsAt }, now), "past");
  }
  assert.equal(getEventPhase({ startsAt: "invalid" }, now), "unknown");
});
