import { ChartNoAxesCombined, Pickaxe, Shield, Swords } from "lucide-react";

const features = [
  { icon: ChartNoAxesCombined, title: "Economia viva", category: "Mercado & profissões", text: "Negocie com jogadores, crie sua loja e construa sua fortuna com leilões e empregos integrados." },
  { icon: Shield, title: "Seu território", category: "Construção & proteção", text: "Proteja sua base, defina permissões e desenvolva um território com seus amigos." },
  { icon: Swords, title: "Dungeons & bosses", category: "Exploração & combate", text: "Enfrente criaturas customizadas, explore dungeons e conquiste recompensas para sua jornada." },
  { icon: Pickaxe, title: "Evolução mcMMO", category: "Habilidades & progressão", text: "Aprimore habilidades, domine profissões e trace seus próprios objetivos em um Survival de longo prazo." },
];

export function FeatureGrid() {
  return (
    <section id="recursos" className="section-shell scroll-mt-24 border-y border-white/[0.04] bg-black/20">
      <div className="site-container">
        <div className="flex flex-col justify-between gap-5 md:flex-row md:items-end">
          <div className="max-w-2xl">
            <p className="eyebrow">MMORPG Survival</p>
            <h2 className="mt-3 text-[26px] font-bold uppercase leading-[34px] tracking-[-0.015em] text-ink sm:text-[32px] sm:leading-10">Sua jornada. Seu mundo. Sua evolução.</h2>
          </div>
          <div className="status-chip self-start md:self-auto"><span className="status-dot" /> Survival com progressão</div>
        </div>
        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {features.map(({ icon: Icon, title, text, category }, index) => (
            <article key={title} className="feature-card relative overflow-hidden !border-violet/20 bg-gradient-to-br from-elevated/70 to-card hover:border-violet/40">
              <div className="flex items-center justify-between"><span className="icon-well"><Icon size={23} aria-hidden="true" /></span><span className="font-mono text-3xl font-bold text-white/10" aria-hidden="true">0{index + 1}</span></div>
              <p className="micro-label mt-6 !text-ultraviolet">{category}</p>
              <h3 className="mt-5 text-lg font-bold uppercase tracking-tight text-ink">{title}</h3>
              <p className="mt-3 text-sm leading-6 text-muted">{text}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
