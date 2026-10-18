import type { ReactNode } from "react";
import { Footer } from "./footer";
import { SiteHeader } from "./site-header";

type NetworkPageActive = "/play" | "/status" | "/online" | "/leaderboards" | "/player";

export function NetworkPage({ active, title, description, children }: {
  active: NetworkPageActive; title: string; description: string; children: ReactNode;
}) {
  const isPlayer = active === "/player";
  return <>
    <SiteHeader />
    <main id="main-content" className="site-container min-h-[70vh] py-8 sm:py-12">
      <div>
        <header className="mb-6 border-l-2 border-violet pl-4 sm:pl-5">
          <p className="eyebrow">{isPlayer ? "Jogadores SwiftMC" : "Jogar / Servidor"}</p>
          <h1 className="page-title mt-2">{title}</h1>
          <p className="page-description">{description}</p>
        </header>
        {children}
      </div>
    </main>
    <Footer />
  </>;
}
