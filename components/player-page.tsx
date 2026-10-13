import type { ReactNode } from "react";
import { Footer } from "./footer";
import { SiteHeader } from "./site-header";

export function PlayerPage({ title, description, eyebrow = "Central do jogador", children }: { title: string; description: string; eyebrow?: string; children: ReactNode }) {
  return <>
    <SiteHeader />
    <main id="main-content" className="site-container min-h-[70vh] py-12 sm:py-20">
      <header className="mb-10 max-w-3xl">
        <p className="eyebrow">{eyebrow}</p>
        <h1 className="mt-4 text-4xl font-extrabold uppercase tracking-tight text-ink sm:text-5xl">{title}</h1>
        <p className="mt-5 text-base leading-7 text-muted">{description}</p>
      </header>
      {children}
    </main>
    <Footer />
  </>;
}
