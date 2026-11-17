import type { EventPost } from "./types";

/**
 * Published events only. Do not add fictional or unconfirmed events.
 * `startsAt` drives upcoming/past classification at request time.
 */
export const eventPosts: readonly EventPost[] = [];
