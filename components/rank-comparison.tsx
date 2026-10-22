import { Check, Minus } from "lucide-react";
import { getRankMounts, ranks } from "@/data/ranks";

type ComparisonRow = {
  label: string;
  value: (rank: (typeof ranks)[number]) => string | number | boolean;
};

const rows: readonly ComparisonRow[] = [
  { label: "Preço mensal", value: (rank) => rank.price ?? "Preço em breve" },
  { label: "Duração", value: (rank) => rank.duration },
  { label: "Montarias confirmadas (inclui herdadas)", value: (rank) => {
    const mounts = getRankMounts(rank.slug);
    const flying = mounts.filter((mount) => mount.type === "flying").length;
    return `${mounts.length} · ${mounts.length - flying} terrestre${mounts.length - flying === 1 ? "" : "s"}${flying ? ` + ${flying} voadora${flying === 1 ? "" : "s"}` : ""}`;
  } },
  { label: "Homes", value: (rank) => rank.comparison.homes },
  { label: "XP mcMMO", value: (rank) => rank.comparison.mcmmoXpBonus },
  { label: "Bancadas portáteis", value: (rank) => rank.comparison.portableWorkstations },
  { label: "Blocos de claim — Boas-vindas (resgate único)", value: (rank) => rank.welcomeKit.claimBlocks?.toLocaleString("pt-BR") ?? "—" },
  { label: "Dinheiro/mês", value: (rank) => `$${rank.comparison.monthlyMoney.toLocaleString("pt-BR")}` },
];

function ComparisonValue({ value }: { value: string | number | boolean }) {
  if (typeof value === "boolean") {
    return value ? (
      <span className="inline-flex items-center gap-1.5"><Check size={17} aria-hidden="true" /> Sim</span>
    ) : (
      <span className="inline-flex items-center gap-1.5 text-muted"><Minus size={17} aria-hidden="true" /> Não</span>
    );
  }

  return <span>{value}</span>;
}

export function RankComparison() {
  return (
    <div tabIndex={0} role="region" aria-label="Comparação de ranks" className="content-panel overflow-x-auto">
      <table className="w-full min-w-[720px] border-collapse text-left">
        <thead>
          <tr className="border-b border-white/[0.08] bg-white/[0.025]">
            <th scope="col" className="p-5 text-xs font-bold uppercase tracking-wider text-muted">Benefício</th>
            {ranks.map((rank) => (
              <th key={rank.slug} scope="col" className={`p-5 text-lg font-extrabold uppercase`} style={{ color: rank.color.primary }}>
                {rank.name}
                {rank.featured && <span className="micro-label mt-1" style={{ color: rank.color.primary }}>Mais popular</span>}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.label} className="border-b border-white/[0.06] last:border-0">
              <th scope="row" className="p-5 text-sm font-semibold text-ink">{row.label}</th>
              {ranks.map((rank) => (
                <td key={rank.slug} className="p-5 text-sm font-semibold text-muted" style={{ color: rank.featured ? rank.color.primary : undefined, backgroundColor: rank.featured ? `${rank.color.primary}0a` : undefined }}>
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
