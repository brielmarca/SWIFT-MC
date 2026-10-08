import { Check, Minus } from "lucide-react";
import { ranks } from "@/data/ranks";

type ComparisonRow = {
  label: string;
  value: (rank: (typeof ranks)[number]) => string | number | boolean;
};

const rows: readonly ComparisonRow[] = [
  { label: "Duração", value: (rank) => rank.duration },
  { label: "Homes", value: (rank) => rank.comparison.homes },
  { label: "XP mcMMO", value: (rank) => rank.comparison.mcmmoXpBonus },
  { label: "Bancadas portáteis", value: (rank) => rank.comparison.portableWorkstations },
  { label: "Blocos de claim/mês", value: (rank) => rank.comparison.monthlyClaimBlocks.toLocaleString("pt-BR") },
  { label: "Dinheiro/mês", value: (rank) => `$${rank.comparison.monthlyMoney.toLocaleString("pt-BR")}` },
];

function ComparisonValue({ value }: { value: string | number | boolean }) {
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
      <table className="w-full min-w-[720px] border-collapse text-left">
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