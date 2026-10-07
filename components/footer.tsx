import { CopyIpButton } from "./copy-ip-button";
import { Logo } from "./logo";
import { DiscordLink } from "./discord-link";
import { ServerAddress } from "./server-status-provider";
import Link from "next/link";
import { playerLinks } from "@/data/server-info";

export function Footer() {
  return (
    <footer className="border-t border-white/[0.06] bg-black/30 py-10">
      <div className="site-container grid gap-10 md:grid-cols-2 lg:grid-cols-4">
        <div className="lg:col-span-2">
          <Logo />
          <p className="mt-4 max-w-md text-sm leading-6 text-muted">Rede brasileira de Minecraft Survival moderno, economia balanceada e comunidade ativa.</p>
          <div className="mt-5 flex flex-wrap items-center gap-2">
            <code className="break-all rounded-lg border border-white/[0.07] bg-card px-3 py-2.5 text-xs text-ink"><ServerAddress /></code>
            <CopyIpButton compact />
          </div>
        </div>
        <div>
          <h2 className="micro-label !text-ultraviolet">Navegação</h2>
          <div className="mt-4 grid gap-3 text-sm text-muted">
            <a href="/#inicio" className="hover:text-ink">Início</a>
            <a href="/store" className="hover:text-ink">Ranks</a>
            <a href="/#recursos" className="hover:text-ink">Recursos</a>
            {playerLinks.map((link) => <Link key={link.href} href={link.href} className="inline-flex min-h-11 items-center rounded hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ultraviolet">{link.label}</Link>)}
          </div>
        </div>
        <div>
          <h2 className="micro-label !text-ultraviolet">Plataformas</h2>
          <div className="mt-4 grid gap-3 text-sm text-muted">
            <span>Java Edition</span>
            <span>Bedrock Edition</span>
            <DiscordLink className="hover:text-ink">Suporte no Discord</DiscordLink>
          </div>
        </div>
      </div>
      <div className="site-container mt-10 border-t border-white/[0.06] pt-6 text-xs leading-5 text-muted">
        <p>SWIFT MC nao e afiliada a Mojang Studios ou Microsoft. Minecraft e uma marca registrada da Microsoft Corporation.</p>
      </div>
    </footer>
  );
}
