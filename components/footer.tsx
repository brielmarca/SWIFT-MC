import { CopyIpButton } from "./copy-ip-button";
import { Logo } from "./logo";
import { ServerAddress } from "./server-status-provider";
import Link from "next/link";

type FooterLink = { href: string; label: string; external?: boolean };

const footerLinks = {
  jogar: [
    { href: "/play", label: "Jogar" },
    { href: "/store", label: "Loja" },
    { href: "/status", label: "Status" },
  ] as FooterLink[],
  comunidade: [
    { href: "/player", label: "Jogadores" },
    { href: "/online", label: "Online" },
    { href: "/leaderboards", label: "Ranking" },
    { href: "/news", label: "Notícias" },
    { href: "/events", label: "Eventos" },
    { href: "https://discord.gg/Bupp8tWvpu", label: "Discord", external: true },
  ] as FooterLink[],
  recursos: [
    { href: "/wiki", label: "Wiki" },
    { href: "/rules", label: "Regras" },
    { href: "/faq", label: "FAQ" },
  ] as FooterLink[],
};

export function Footer() {
  return (
    <footer className="border-t border-white/[0.06] bg-black/30 py-12">
      <div className="site-container grid gap-8 md:grid-cols-2 lg:grid-cols-4">
        <div className="lg:col-span-1">
          <Logo />
          <p className="mt-4 max-w-xs text-sm leading-6 text-muted">Rede brasileira de Minecraft Survival moderno, economia balanceada e comunidade ativa.</p>
          <div className="mt-5 flex flex-wrap items-center gap-2">
            <code className="break-all rounded-lg border border-white/[0.07] bg-card px-3 py-2.5 text-xs text-ink"><ServerAddress /></code>
            <CopyIpButton compact />
          </div>
        </div>

        <div>
          <h2 className="micro-label !text-ultraviolet">Jogar</h2>
          <div className="mt-4 grid gap-2 text-sm text-muted">
            {footerLinks.jogar.map((link) => (
              <a
                key={link.href}
                href={link.href}
                target={link.external ? "_blank" : undefined}
                rel={link.external ? "noopener noreferrer" : undefined}
                className="hover:text-ink transition-colors"
              >
                {link.label}
              </a>
            ))}
          </div>
        </div>

        <div>
          <h2 className="micro-label !text-ultraviolet">Comunidade</h2>
          <div className="mt-4 grid gap-2 text-sm text-muted">
            {footerLinks.comunidade.map((link) => (
              <a
                key={link.href}
                href={link.href}
                target={link.external ? "_blank" : undefined}
                rel={link.external ? "noopener noreferrer" : undefined}
                className="hover:text-ink transition-colors"
              >
                {link.label}
              </a>
            ))}
          </div>
        </div>

        <div>
          <h2 className="micro-label !text-ultraviolet">Recursos</h2>
          <div className="mt-4 grid gap-2 text-sm text-muted">
            {footerLinks.recursos.map((link) => (
              <Link key={link.href} href={link.href} className="hover:text-ink transition-colors">
                {link.label}
              </Link>
            ))}
          </div>
        </div>
      </div>

      <div className="site-container mt-10 border-t border-white/[0.06] pt-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs leading-5 text-muted">
        <p>SWIFT MC não é afiliada a Mojang Studios ou Microsoft. Minecraft é uma marca registrada da Microsoft Corporation.</p>
        <p>&copy; {new Date().getFullYear()} SWIFT MC. Todos os direitos reservados.</p>
      </div>
    </footer>
  );
}