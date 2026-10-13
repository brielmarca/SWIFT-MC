import Link from "next/link";
import { ArrowLeft, BookOpen, CalendarDays, CircleHelp, Newspaper, ShieldCheck } from "lucide-react";
import type { ReactNode } from "react";
import { Footer } from "../footer";
import { SiteHeader } from "../site-header";

const sections = [
  { href: "/wiki", label: "Wiki", icon: BookOpen },
  { href: "/news", label: "Notícias", icon: Newspaper },
  { href: "/events", label: "Eventos", icon: CalendarDays },
] as const;
const helpSections = [
  { href: "/rules", label: "Regras", icon: ShieldCheck },
  { href: "/faq", label: "FAQ", icon: CircleHelp },
  sections[0],
] as const;

export function ContentPage({ active, title, description, backLabel, metadata, children }: {
  active: typeof sections[number]["href"] | "/rules" | "/faq";
  title: string;
  description: string;
  backLabel?: string;
  metadata?: ReactNode;
  children: ReactNode;
}) {
  const isHelp = active === "/rules" || active === "/faq";
  return <>
    <SiteHeader />
    <main id="main-content" className="site-container min-h-[70vh] py-8 sm:py-12">
      <div>
        <nav aria-label={isHelp ? "Ajuda SwiftMC" : "Conteúdo SwiftMC"} className="mb-6 flex gap-1 border-b border-white/10 sm:gap-4">
          {(isHelp ? helpSections : sections).map(({ href, label, icon: Icon }) => <Link key={href} href={href} aria-current={active === href ? "page" : undefined} className={`inline-flex min-h-11 flex-1 items-center justify-center gap-2 border-b-2 px-2 text-xs font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ultraviolet sm:flex-none sm:px-4 sm:text-sm ${active === href ? "border-ultraviolet text-ultraviolet" : "border-transparent text-muted hover:border-violet/30 hover:text-ink"}`}>
            <Icon size={16} aria-hidden="true" className="hidden shrink-0 sm:block" />{label}
          </Link>)}
        </nav>
        {backLabel && <Link href={active} className="mb-5 inline-flex min-h-11 items-center gap-2 rounded-lg text-xs font-bold text-ultraviolet focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ultraviolet"><ArrowLeft size={16} aria-hidden="true" />{backLabel}</Link>}
        <header className="mb-6 max-w-3xl border-l-2 border-violet pl-4 sm:mb-8 sm:pl-5">
          <p className="eyebrow">{isHelp ? "Comunidade SwiftMC" : "Universo SwiftMC"}</p>
          <h1 className={`page-title mt-2 [overflow-wrap:anywhere] ${backLabel ? "normal-case" : ""}`}>{title}</h1>
          <p className="page-description">{description}</p>
          {metadata && <div className="mt-4 flex flex-wrap items-center gap-2">{metadata}</div>}
        </header>
        {children}
      </div>
    </main>
    <Footer />
  </>;
}
