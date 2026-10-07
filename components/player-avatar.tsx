"use client";

import Image from "next/image";
import { useState } from "react";
import type { MinecraftProfile } from "@/lib/minecraft-profile";

export function PlayerAvatar({ profile, body = false, size = "md" }: { profile: MinecraftProfile; body?: boolean; size?: "md" | "sm" }) {
  const [failed, setFailed] = useState(false);
  if (body) return <div className="flex h-96 w-full items-center justify-center rounded-xl border border-violet/20 bg-void/60">
    {failed ? <div className="flex flex-col items-center gap-4 px-4 text-center"><PlayerAvatar profile={profile} /><p className="text-sm text-muted">Visual da skin indisponível.</p></div> : <Image unoptimized src={`${profile.avatarUrl}?view=body`} width={192} height={384} alt={`Visual da skin de ${profile.username}`} onError={() => setFailed(true)} className="h-80 w-48 object-contain [image-rendering:pixelated]" />}
  </div>;
  const headClass = size === "sm" ? "h-9 w-9 rounded-md" : "h-16 w-16 rounded-lg";
  return failed ? <span role="img" aria-label={`Avatar de ${profile.username} indisponível`} className={`grid shrink-0 place-items-center bg-violet/15 text-xs text-muted ${headClass}`}>Sem avatar</span> : <Image unoptimized src={profile.avatarUrl} width={size === "sm" ? 36 : 64} height={size === "sm" ? 36 : 64} alt={`Cabeça de ${profile.username}`} onError={() => setFailed(true)} className={`shrink-0 [image-rendering:pixelated] ${headClass}`} />;
}
