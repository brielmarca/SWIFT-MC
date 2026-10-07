import { ChartNoAxesCombined, Pickaxe, Shield, Swords } from "lucide-react";

const features = [
  { icon: ChartNoAxesCombined, title: "Economia e mercado", text: "Mercado dinamico entre jogadores, leiloes, lojas em terrenos e empregos integrados." },
  { icon: Shield, title: "Protecao de terrenos", text: "Proteja construcoes, controle permissoes e compartilhe seu espaco com amigos." },
  { icon: Swords, title: "Dungeons e bosses", text: "Desafios semanais, criaturas customizadas e recompensas que valorizam sua progressao." },
  { icon: Pickaxe, title: "mcMMO e jobs", text: "Habilidades, profissoes e objetivos de longo prazo em um mundo feito para durar." },
];

export function FeatureGrid() {
  return (
    <section id="recursos" className="section-shell scroll-mt-24 border-y border-white/[0.04] bg-black/20">
      <div className="site-container">
        <div className="flex flex-col justify-between gap-5 md:flex-row md:items-end">
          <div className="max-w-2xl">
            <p className="eyebrow">Sobrevivencia avancada</p>
            <h2 className="mt-3 text-[26px] font-bold uppercase leading-[34px] tracking-[-0.015em] text-ink sm:text-[32px] sm:leading-10">Por que jogar no SWIFT Survival?</h2>
          </div>
          <div className="status-chip self-start md:self-auto"><span className="status-dot" /> Anti-griefing | Economia dinamica</div>
        </div>
        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {features.map(({ icon: Icon, title, text }) => (
            <article key={title} className="feature-card">
              <span className="icon-well"><Icon size={23} aria-hidden="true" /></span>
              <h3 className="mt-5 text-lg font-bold uppercase tracking-tight text-ink">{title}</h3>
              <p className="mt-3 text-sm leading-6 text-muted">{text}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
