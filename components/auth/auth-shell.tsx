import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import "./auth.css";

export function AuthShell({ children }: { children: ReactNode }) {
  return (
    <main id="main-content" className="auth-shell">
      <section className="auth-brand" aria-label="SwiftMC">
        <div className="auth-wordmark"><Image src="/brand/emblem.png" alt="" width={48} height={48} />SWIFT <span>MC</span></div>
        <div className="auth-brand-content">
          <Image className="auth-artwork" src="/brand/emblem.png" alt="" width={440} height={440} priority />
          <p className="auth-eyebrow">SEU PRÓXIMO CAPÍTULO</p>
          <h2>Sua jornada<br />continua aqui.</h2>
          <p>Entre na sua conta e continue sua experiência no SwiftMC.</p>
        </div>
        <span className="auth-brand-signature" aria-hidden="true">SWIFTMC / PLAY YOUR WAY</span>
      </section>
      <section className="auth-panel" aria-label="Acesso à conta">
        <Link className="auth-back" href="/">← Voltar ao SwiftMC</Link>
        <div className="auth-panel-content">{children}</div>
        <p className="auth-preview">Experiência em preparação · Acesso ainda indisponível</p>
      </section>
    </main>
  );
}

export function AuthCard({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  return <div className="auth-card"><div className="auth-card-heading"><span className="auth-eyebrow">SUA CONTA SWIFTMC</span><h1>{title}</h1>{subtitle && <p>{subtitle}</p>}</div>{children}</div>;
}
