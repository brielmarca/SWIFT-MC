"use client";

import { useEffect, useEffectEvent } from "react";

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  return ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName);
}

/** Keep global shortcuts lightweight; load the full search dialog only on demand. */
export function useSiteSearchHotkeys(enabled: boolean, onOpen: () => void) {
  const openFromEvent = useEffectEvent(onOpen);
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (!enabled) return;
      if ((event.ctrlKey || event.metaKey) && !event.altKey && !event.shiftKey && event.key.toLowerCase() === "k") {
        event.preventDefault();
        openFromEvent();
      } else if (event.key === "/" && !event.ctrlKey && !event.metaKey && !event.altKey && !event.shiftKey && !event.repeat && !isTypingTarget(event.target)) {
        event.preventDefault();
        openFromEvent();
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [enabled]);
}
