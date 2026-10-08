import { MessageCircle } from "lucide-react";
import { DiscordLink } from "./discord-link";

export function CommunityCTA() {
  return (
    <section id="comunidade" className="section-shell border-t border-white/[0.04]" aria-labelledby="community-heading">
      <div className="site-container">
        <div className="community-card">
          <div className="relative z-10 max-w-2xl">
            <div className="status-chip"><span className="status-dot" /> Comunidade oficial</div>
            <h2 id="community-heading" className="mt-6 text-3xl font-extrabold uppercase tracking-[-0.04em] text-ink sm:text-4xl lg:text-5xl">
              Junte-se à <span className="gradient-text">comunidade SWIFT MC</span>
            </h2>
            <p className="mt-4 text-base leading-7 text-muted">
              Atualizações, suporte, eventos e negociação direta com outros jogadores.
            </p>
            <DiscordLink className="button-primary mt-6"><MessageCircle size={19} aria-hidden="true" /> Entrar no Discord</DiscordLink>
          </div>
        </div>
      </div>
    </section>
  );
}