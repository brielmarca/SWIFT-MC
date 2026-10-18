import Link from "next/link";
import { ArrowLeft, BookOpen, CircleHelp, ShieldCheck } from "lucide-react";
import type { ReactNode } from "react";
import { Footer } from "../footer";
import { SiteHeader } from "../site-header";

const recursosSections = [
  { href: "/wiki", label: "Wiki", icon: BookOpen },
  { href: "/rules", label: "Regras", icon: ShieldCheck },
  { href: "/faq", label: "FAQ", icon: CircleHelp },
] as const;

type ActiveSection = "/community" | "/news" | "/events" | "/player" | "/wiki" | "/rules" | "/faq";

export function ContentPage({ active, title, description, backLabel, metadata, children }: {
  active: ActiveSection;
  title: string;
  description: string;
  backLabel?: string;
  metadata?: ReactNode;
  children: ReactNode;
}) {
  const isRecursos = recursosSections.some((s) => s.href === active);
  const eyebrow = isRecursos ? "Recursos" : "Comunidade";

  return <>
    <SiteHeader />
    <main id="main-content" className="site-container min-h-[70vh] py-8 sm:py-12">
      <div>
        {backLabel && <Link href={isRecursos ? "/wiki" : "/community"} className="mb-5 inline-flex min-h-11 items-center gap-2 rounded-lg text-xs font-bold text-ultraviolet focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ultraviolet"><ArrowLeft size={16} aria-hidden="true" />{backLabel}</Link>}
        <header className="mb-6 max-w-3xl border-l-2 border-violet pl-4 sm:mb-8 sm:pl-5">
          <p className="eyebrow">{eyebrow}</p>
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
