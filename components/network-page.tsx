import Link from "next/link";
import { Activity, Search, Trophy, Users } from "lucide-react";
import type { ReactNode } from "react";
import { Footer } from "./footer";
import { SiteHeader } from "./site-header";

const sections = [
  { href: "/status", label: "Status", icon: Activity },
  { href: "/online", label: "Online", icon: Users },
  { href: "/leaderboards", label: "Ranking", icon: Trophy },
] as const;
const playerSections = [
  { href: "/player", label: "Jogadores", icon: Search },
  sections[1],
  sections[2],
] as const;

export function NetworkPage({ active, title, description, children }: {
  active: typeof sections[number]["href"] | "/player"; title: string; description: string; children: ReactNode;
}) {
  return <>
    <SiteHeader />
    <main id="main-content" className="site-container min-h-[70vh] py-8 sm:py-12">
      <div className="mx-auto max-w-6xl">
        <header className="mb-6 border-l-2 border-violet pl-4 sm:pl-5">
          <p className="eyebrow">{active === "/player" ? "Jogadores SwiftMC" : "Rede SwiftMC"}</p>
          <h1 className="mt-2 text-2xl font-extrabold uppercase tracking-tight text-ink sm:text-3xl">{title}</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">{description}</p>
        </header>
        <nav aria-label="Rede SwiftMC" className="mb-6 grid grid-cols-3 gap-1 rounded-xl border border-white/10 bg-void/80 p-1.5 sm:mb-8 sm:flex sm:gap-2">
          {(active === "/player" ? playerSections : sections).map(({ href, label, icon: Icon }) => <Link key={href} href={href} aria-current={active === href ? "page" : undefined}
            className={`flex min-h-11 items-center justify-center gap-2 rounded-lg border px-3 text-xs font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ultraviolet sm:min-w-36 sm:text-sm ${active === href ? "border-violet/40 bg-violet/15 text-ultraviolet" : "border-transparent text-muted hover:bg-white/5 hover:text-ink"}`}>
            <Icon size={16} aria-hidden="true" className="hidden shrink-0 sm:block" />{label}
          </Link>)}
        </nav>
        {children}
      </div>
    </main>
    <Footer />
  </>;
}
