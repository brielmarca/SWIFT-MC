import type { ReactNode } from "react";
import { findMatchRanges } from "@/lib/site-search";

/** Renders `text` with every accent- and case-insensitive match of `query` highlighted. */
export function Highlight({ text, query, className = "text-ultraviolet" }: { text: string; query: string; className?: string }) {
  const ranges = findMatchRanges(text, query);
  if (!ranges.length) return <>{text}</>;
  const parts: ReactNode[] = [];
  let cursor = 0;
  ranges.forEach(([start, end], index) => {
    if (start > cursor) parts.push(text.slice(cursor, start));
    parts.push(<mark key={index} className={`bg-transparent ${className}`}>{text.slice(start, end)}</mark>);
    cursor = end;
  });
  if (cursor < text.length) parts.push(text.slice(cursor));
  return <>{parts}</>;
}
