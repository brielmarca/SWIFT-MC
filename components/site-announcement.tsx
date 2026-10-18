"use client";

import Link from "next/link";
import { X } from "lucide-react";
import { useSyncExternalStore } from "react";
import type { SiteAnnouncement } from "@/data/content";

const storageKey = (id: string) => `swift-mc-announcement:${id}`;
const CHANGE_EVENT = "swift-mc-announcement-changed";

function subscribe(onStoreChange: () => void) {
  const handle = () => onStoreChange();
  // `storage` syncs dismissal across tabs; the custom event covers this tab.
  window.addEventListener("storage", handle);
  window.addEventListener(CHANGE_EVENT, handle);
  return () => {
    window.removeEventListener("storage", handle);
    window.removeEventListener(CHANGE_EVENT, handle);
  };
}

function readDismissed(key: string): boolean {
  if (!key) return false;
  try {
    return window.localStorage.getItem(key) === "1";
  } catch {
    return false;
  }
}

/**
 * Site-wide announcement. Renders during SSR (server snapshot assumes it is
 * visible) and hides after hydration only when localStorage confirms the
 * visitor dismissed this announcement id.
 */
export function SiteAnnouncement({ announcement }: { announcement: SiteAnnouncement | null }) {
  const key = announcement ? storageKey(announcement.id) : "";
  const dismissed = useSyncExternalStore(subscribe, () => readDismissed(key), () => false);

  if (!announcement || dismissed) return null;

  const dismiss = () => {
    try {
      window.localStorage.setItem(key, "1");
    } catch { /* Storage may be unavailable; the event below still hides it for this visit. */ }
    window.dispatchEvent(new Event(CHANGE_EVENT));
  };

  return (
    <div role="region" aria-label={`Aviso: ${announcement.title}`} className="border-b border-violet/30 bg-gradient-to-r from-deep/50 via-violet/25 to-deep/50">
      <div className="site-container flex min-h-12 items-start justify-between gap-3 py-2.5 lg:items-center">
        <p className="flex min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-1 text-sm leading-6">
          <span className="status-chip !min-h-6 !text-ultraviolet">Aviso</span>
          <strong className="font-bold text-ink">{announcement.title}</strong>
          <span className="text-slate-200">{announcement.message}</span>
          {announcement.href && announcement.linkLabel && (
            <Link href={announcement.href} className="inline-flex min-h-11 items-center font-bold text-ultraviolet underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ultraviolet">
              {announcement.linkLabel}
            </Link>
          )}
        </p>
        <button
          type="button"
          onClick={dismiss}
          aria-label="Dispensar este aviso"
          className="icon-button"
        >
          <X size={16} aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
