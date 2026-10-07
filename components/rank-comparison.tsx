import { Check, Minus } from "lucide-react";
import { ranks } from "@/data/ranks";

type ComparisonRow = {
  label: string;
  value: (rank: (typeof ranks)[number]) => string | boolean;
};

const rows: readonly ComparisonRow[] = [
  { label: "Duração", value: (rank) => rank.duration },
  { label: "Terrenos extras", value: (rank) => rank.comparison.protectedLands },
  { label: "Multiplicador de mercado", value: (rank) => rank.comparison.marketMultiplier },
  { label: "Multiplicador mcMMO", value: (rank) => rank.comparison.mcmmoMultiplier },
  { label: "Baús virtuais", value: (rank) => rank.comparison.virtualChests },
  { label: "Entrada com servidor lotado", value: (rank) => rank.comparison.fullServerAccess },
];

function ComparisonValue({ value }: { value: string | boolean }) {
  if (typeof value === "boolean") {
    return value ? (
      <span className="inline-flex items-center gap-1.5 text-ultraviolet"><Check size={17} aria-hidden="true" /> Sim</span>
    ) : (
      <span className="inline-flex items-center gap-1.5 text-muted"><Minus size={17} aria-hidden="true" /> Não</span>
    );
  }

  return <span>{value}</span>;
}

export function RankComparison() {
  return (
    <div className="overflow-x-auto rounded-2xl border border-white/[0.07] bg-card/80 shadow-card">
      <table className="w-full min-w-[680px] border-collapse text-left">
        <thead>
          <tr className="border-b border-white/[0.08] bg-white/[0.025]">
            <th scope="col" className="p-5 text-xs font-bold uppercase tracking-wider text-muted">Benefício</th>
            {ranks.map((rank) => (
              <th key={rank.slug} scope="col" className={`p-5 text-lg font-extrabold uppercase ${rank.featured ? "text-ultraviolet" : "text-ink"}`}>
                {rank.name}
                {rank.featured && <span className="micro-label mt-1 !text-ultraviolet">Mais popular</span>}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.label} className="border-b border-white/[0.06] last:border-0">
              <th scope="row" className="p-5 text-sm font-semibold text-ink">{row.label}</th>
              {ranks.map((rank) => (
                <td key={rank.slug} className={`p-5 text-sm font-semibold ${rank.featured ? "bg-violet/[0.04] text-ink" : "text-muted"}`}>
                  <ComparisonValue value={row.value(rank)} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
