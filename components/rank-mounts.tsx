import { getMountSummary, getRank, getRankMounts, type Rank } from "@/data/ranks";

export function RankMounts({ rank }: { rank: Rank }) {
  const mounts = getRankMounts(rank.slug);
  const inheritedRanks = [...new Set(mounts.flatMap((mount) => mount.inheritedFrom ? [mount.inheritedFrom] : []))];

  return (
    <section className="page-section border-y border-white/10 bg-black/20" aria-labelledby="mounts-heading">
      <div className="site-container">
        <p className="eyebrow">Coleção VIP · SwiftMounts</p>
        <h2 id="mounts-heading" className="page-heading mt-3">Montarias</h2>
        <p className="mt-4 text-base leading-7 text-muted">{getMountSummary(rank.slug)} no VIP {rank.name}.</p>
        {inheritedRanks.length > 0 && (
          <p className="mt-2 text-sm leading-6 text-muted">Inclui as montarias dos VIPs {inheritedRanks.map((slug) => getRank(slug)!.name).join(" + ")}.</p>
        )}
        <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {mounts.map((mount) => (
            <article key={mount.name} className="content-panel overflow-hidden" style={{ borderColor: `${rank.color.primary}33` }}>
              <div className="p-5">
                <span className="rounded border px-2 py-1 text-xs font-semibold" style={{ color: rank.color.primary, borderColor: `${rank.color.primary}4d` }}>{mount.type === "flying" ? "Voadora" : "Terrestre"}</span>
                <h3 className="mt-4 text-lg font-bold text-ink">{mount.name}</h3>
                <p className="mt-1 text-xs text-muted">{mount.inheritedFrom ? `Herdada do VIP ${getRank(mount.inheritedFrom)!.name}` : `Exclusiva do VIP ${rank.name}`}</p>
                <p className="mt-3 text-sm leading-6 text-muted">{mount.description}</p>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
