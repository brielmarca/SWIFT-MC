import { CopyIpButton } from "./copy-ip-button";
import { Logo } from "./logo";
import { ServerAddress } from "./server-status-provider";
import Link from "next/link";

type FooterLink = { href: string; label: string; external?: boolean };

const footerLinks = {
  jogar: [
    { href: "/play", label: "Como jogar" },
    { href: "/status", label: "Status e conexão" },
  ] as FooterLink[],
  loja: [
    { href: "/store", label: "VIPs" },
  ] as FooterLink[],
  comunidade: [
    { href: "/news", label: "Notícias" },
    { href: "/lore", label: "Lore" },
    { href: "https://discord.gg/Bupp8tWvpu", label: "Discord", external: true },
  ] as FooterLink[],
  recursos: [
    { href: "/wiki", label: "Wiki" },
    { href: "/rules", label: "Regras" },
    { href: "/faq", label: "FAQ" },
  ] as FooterLink[],
  legal: [
    { href: "/privacy", label: "Privacidade" },
    { href: "/terms", label: "Termos de compra" },
    { href: "/refund", label: "Reembolso" },
  ] as FooterLink[],
};

export function Footer() {
  return (
    <footer className="border-t border-white/[0.06] bg-black/30 py-12">
      <div className="site-container grid grid-cols-2 gap-x-6 gap-y-8 lg:grid-cols-6">
        <div className="col-span-2 lg:col-span-2">
          <Logo />
          <p className="mt-4 max-w-xs text-sm leading-6 text-muted">Servidor Minecraft Java 1.21.11 com Survival, economia e comunidade.</p>
          <div className="mt-5 flex flex-wrap items-center gap-2">
            <code className="break-all rounded-lg border border-white/[0.07] bg-card px-3 py-2.5 text-xs text-ink"><ServerAddress /></code>
            <CopyIpButton compact />
          </div>
        </div>
        {[['Jogar / Servidor', footerLinks.jogar], ['Loja', footerLinks.loja], ['Comunidade', footerLinks.comunidade], ['Recursos e legal', [...footerLinks.recursos, ...footerLinks.legal]]].map(([title, links]) => (
          <div key={title as string}>
            <h2 className="micro-label !text-ultraviolet">{title as string}</h2>
            <div className="mt-3 grid">
              {(links as FooterLink[]).map((link) => link.external || link.href.startsWith('http') ? (
                <a key={link.href} href={link.href} target={link.external ? "_blank" : undefined} rel={link.external ? "noopener noreferrer" : undefined} className="footer-link">{link.label}</a>
              ) : (
                <Link key={link.href} href={link.href} className="footer-link">{link.label}</Link>
              ))}
            </div>
          </div>
        ))}
      </div>
      <div className="site-container mt-10 flex flex-col items-start justify-between gap-4 border-t border-white/10 pt-6 text-xs leading-5 text-muted lg:flex-row">
        <p>Swift MC não é afiliada a Mojang Studios ou Microsoft. Minecraft é uma marca registrada da Microsoft Corporation.</p>
        <p>&copy; {new Date().getFullYear()} Swift MC. Todos os direitos reservados.</p>
      </div>
    </footer>
  );
}
