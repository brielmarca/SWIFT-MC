import type { EventPost } from "@/data/content/types";

export type EventPhase = "upcoming" | "active" | "ended" | "past" | "unknown";

/** Presentation only: a past start without a valid end does not prove an event has ended. */
export function getEventPhase(event: Pick<EventPost, "startsAt" | "endsAt">, now: number): EventPhase {
  const start = Date.parse(event.startsAt);
  if (!Number.isFinite(start)) return "unknown";
  if (start > now) return "upcoming";
  const end = event.endsAt ? Date.parse(event.endsAt) : NaN;
  if (!Number.isFinite(end) || end < start) return "past";
  return now < end ? "active" : "ended";
}
