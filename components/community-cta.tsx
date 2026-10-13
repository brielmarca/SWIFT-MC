import { MessageCircle } from "lucide-react";
import Image from "next/image";
import { DiscordLink } from "./discord-link";

export function CommunityCTA() {
  return (
    <section id="comunidade" className="section-shell border-t border-white/[0.04]" aria-labelledby="community-heading">
      <div className="site-container">
        <div className="community-card lg:!pr-80">
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
          <div className="pointer-events-none relative ml-auto mt-6 h-56 w-40 sm:h-64 sm:w-48 lg:absolute lg:inset-y-6 lg:right-8 lg:mt-0 lg:h-auto lg:w-60">
            <Image
              src="/brand/enderman.png"
              alt="Enderman da SWIFT MC segurando um bloco de grama"
              fill
              sizes="(max-width: 640px) 160px, (max-width: 1024px) 192px, 240px"
              className="object-contain object-right-bottom opacity-90 drop-shadow-[0_0_32px_rgba(168,85,247,0.28)]"
            />
          </div>
        </div>
      </div>
    </section>
  );
}
