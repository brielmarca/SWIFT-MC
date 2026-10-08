import Link from "next/link";
import { PlayerAvatar } from "./player-avatar";

export function NetworkPlayerRank({ rank }: { rank: string }) {
  return <span className="inline-block max-w-full break-words rounded border border-violet/25 bg-violet/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-ultraviolet">{rank}</span>;
}

export function NetworkPlayer({ player, compact = false }: { player: { username: string; uuid: string; rank: string | null }; compact?: boolean }) {
  return <Link href={`/player/${encodeURIComponent(player.username)}`} className="group flex min-w-0 items-center gap-3 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ultraviolet">
    <PlayerAvatar profile={{ username: player.username, uuid: player.uuid, avatarUrl: `/api/minecraft/avatar/${player.uuid}` }} size={compact ? "sm" : "md"} />
    <div className="min-w-0">
      <span className="block break-all text-sm font-bold text-ink transition group-hover:text-ultraviolet">{player.username}</span>
      {player.rank && <div className="mt-1.5"><NetworkPlayerRank rank={player.rank} /></div>}
    </div>
  </Link>;
}
