import { Gift, Headphones, MessageCircle, Users } from "lucide-react";
import Image from "next/image";
import { DiscordLink } from "./discord-link";

export function CommunityBanner() {
  return (
    <section id="comunidade" className="pb-20 pt-2 scroll-mt-24 sm:pb-24">
      <div className="site-container">
        <div className="community-card">
          <div className="relative z-10 max-w-2xl">
            <div className="status-chip"><span className="status-dot" /> Comunidade oficial</div>
            <h2 className="mt-6 text-3xl font-extrabold uppercase tracking-[-0.04em] text-ink sm:text-4xl lg:text-5xl">
              Junte-se à <span className="gradient-text">comunidade SWIFT MC</span>
            </h2>
            <p className="mt-5 text-base leading-7 text-muted">
              Receba atualizacoes, participe de sorteios, negocie itens raros e fale diretamente com nossa equipe de suporte.
            </p>
            <div className="mt-6 flex flex-wrap gap-x-6 gap-y-3 text-xs font-bold uppercase tracking-wider text-muted">
              <span className="flex items-center gap-2"><Gift size={17} className="text-ultraviolet" aria-hidden="true" /> Sorteios semanais</span>
              <span className="flex items-center gap-2"><Headphones size={17} className="text-ultraviolet" aria-hidden="true" /> Suporte direto</span>
              <span className="flex items-center gap-2"><Users size={17} className="text-ultraviolet" aria-hidden="true" /> Comunidade ativa</span>
            </div>
            <DiscordLink className="button-primary mt-8"><MessageCircle size={19} aria-hidden="true" /> Entrar no Discord</DiscordLink>
          </div>
          <Image
            src="/brand/enderman.png"
            alt="Enderman da SWIFT MC segurando um bloco de grama"
            width={982}
            height={1602}
            sizes="(max-width: 1024px) 0px, 320px"
            className="pointer-events-none absolute -bottom-20 right-3 hidden h-[460px] w-auto object-contain opacity-80 drop-shadow-[0_0_32px_rgba(168,85,247,0.28)] lg:block"
          />
        </div>
      </div>
    </section>
  );
}
