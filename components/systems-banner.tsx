import { ShieldCheck, Sparkles, Swords } from "lucide-react";

export function SystemsBanner() {
  return (
    <section className="section-shell">
      <div className="site-container">
        <div className="systems-card">
          <div className="relative z-10 max-w-2xl">
            <div className="flex flex-wrap items-center gap-3">
              <span className="rank-badge rank-badge-featured">Novidade 1.20+</span>
              <span className="micro-label">Sistemas exclusivos</span>
            </div>
            <h2 className="mt-5 text-3xl font-extrabold uppercase tracking-[-0.03em] text-ink">Um Survival feito para evoluir</h2>
            <p className="mt-4 text-base leading-7 text-muted">
              Pedras de protecao especiais, economia guiada pelos jogadores, chefes semanais e trabalhos integrados em uma experiencia coesa.
            </p>
            <div className="mt-7 flex flex-col gap-4 text-sm text-ink sm:flex-row sm:items-center sm:gap-7">
              <span className="flex items-center gap-2"><Sparkles className="text-ultraviolet" aria-hidden="true" /> <strong>+50</strong> habilidades mcMMO</span>
              <span className="flex items-center gap-2"><ShieldCheck className="text-ultraviolet" aria-hidden="true" /> <strong>100%</strong> anti-grief</span>
            </div>
          </div>
          <a href="#inicio" className="button-secondary relative z-10 shrink-0"><Swords size={18} className="text-ultraviolet" aria-hidden="true" /> Comecar a jogar</a>
        </div>
      </div>
    </section>
  );
}
