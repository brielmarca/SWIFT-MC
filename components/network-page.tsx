import Link from "next/link";
import { Activity, Search, Trophy, Users, Wrench } from "lucide-react";
import type { ReactNode } from "react";
import { Footer } from "./footer";
import { SiteHeader } from "./site-header";

const jogarSections = [
  { href: "/play", label: "Como jogar", icon: Wrench },
  { href: "/status", label: "Status", icon: Activity },
  { href: "/online", label: "Online", icon: Users },
  { href: "/leaderboards", label: "Ranking", icon: Trophy },
] as const;
const playerSections = [
  { href: "/player", label: "Jogadores", icon: Search },
  jogarSections[2],
  jogarSections[3],
] as const;

export function NetworkPage({ active, title, description, children }: {
  active: typeof jogarSections[number]["href"] | "/player"; title: string; description: string; children: ReactNode;
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
        <nav aria-label={isPlayer ? "Jogadores SwiftMC" : "Jogar / Servidor"} className={`mb-6 grid gap-1 rounded-xl border border-white/10 bg-void/80 p-1.5 sm:mb-8 sm:gap-2 ${isPlayer ? "grid-cols-3" : "grid-cols-2 sm:grid-cols-4"}`}>
          {(isPlayer ? playerSections : jogarSections).map(({ href, label, icon: Icon }) => <Link key={href} href={href} aria-current={active === href ? "page" : undefined}
            className={`flex min-h-11 items-center justify-center gap-2 rounded-lg border px-3 text-xs font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ultraviolet sm:text-sm ${active === href ? "border-violet/40 bg-violet/15 text-ultraviolet" : "border-transparent text-muted hover:bg-white/5 hover:text-ink"}`}>
            <Icon size={16} aria-hidden="true" className="hidden shrink-0 sm:block" />{label}
          </Link>)}
        </nav>
        {children}
      </div>
    </main>
    <Footer />
  </>;
}
