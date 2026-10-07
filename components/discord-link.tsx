import type { ReactNode } from "react";

export function getDiscordUrl(value = process.env.NEXT_PUBLIC_DISCORD_URL): string | null {
  try {
    const url = new URL(value || "");
    if (url.protocol !== "https:" || url.username || url.password || url.port) return null;
    if (url.hostname !== "discord.gg" && url.hostname !== "discord.com") return null;
    return url.toString();
  } catch { return null; }
}

export function DiscordLink({ children, className }: { children: ReactNode; className?: string }) {
  const url = getDiscordUrl();
  return url ? <a href={url} target="_blank" rel="noopener noreferrer" className={className}>{children}</a>
    : <span aria-disabled="true" className={`${className || ""} cursor-not-allowed opacity-60`}>Discord em breve</span>;
}
