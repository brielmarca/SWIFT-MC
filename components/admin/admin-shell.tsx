import type { ReactNode } from "react";
import Link from "next/link";
import { AuthHeader } from "@/components/auth-header";
import { Footer } from "@/components/footer";

export type AdminSection = "overview" | "posts" | "orders" | "cancellations" | "privacy" | "users" | "deliveries" | "audit" | "security" | "provisioning" | "media";

const sections: { id: AdminSection; href: string; title: string }[] = [
  { id: "overview", href: "/console-r7m4q9v2", title: "Visão geral" },
  { id: "media", href: "/console-r7m4q9v2/media", title: "Imagens" },
  { id: "posts", href: "/console-r7m4q9v2/posts", title: "Publicações" },
  { id: "orders", href: "/console-r7m4q9v2/orders", title: "Pedidos" },
  { id: "cancellations", href: "/console-r7m4q9v2/cancellations", title: "Cancelamentos" },
  { id: "privacy", href: "/console-r7m4q9v2/privacy", title: "Privacidade" },
  { id: "users", href: "/console-r7m4q9v2/users", title: "Usuários" },
  { id: "deliveries", href: "/console-r7m4q9v2/deliveries", title: "Entregas" },
  { id: "audit", href: "/console-r7m4q9v2/audit", title: "Auditoria" },
  { id: "security", href: "/console-r7m4q9v2/security", title: "Segurança" },
  { id: "provisioning", href: "/console-r7m4q9v2/provisioning", title: "Administradores" },
];

export function AdminShell({
  title, description, section, role, email, children,
}: {
  title: string;
  description: string;
  section: AdminSection;
  role: string;
  email: string | null;
  children: ReactNode;
}) {
  return (
    <>
      <AuthHeader />
      <main id="main-content" className="site-container min-h-[70vh] py-8 sm:py-12">
        <header className="mb-7 flex flex-wrap items-end justify-between gap-4 border-l-2 border-violet pl-4 sm:pl-5">
          <div className="max-w-3xl">
            <p className="eyebrow">SwiftMC / Área restrita</p>
            <h1 className="page-title mt-2">{title}</h1>
            <p className="page-description">{description}</p>
          </div>
          <div className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-right text-xs text-muted">
            <p className="font-semibold text-ink">{role}</p>
            <p className="max-w-[240px] truncate">{email || "Conta Discord"}</p>
          </div>
        </header>
        <nav aria-label="Navegação administrativa" className="mb-7 flex flex-wrap gap-2 border-b border-white/10 pb-5">
          {sections.filter(item => item.id !== "provisioning" || role === "OWNER").map(item => (
            <Link key={item.id} href={item.href} aria-current={item.id === section ? "page" : undefined}
              className={`inline-flex min-h-11 items-center rounded-lg border px-4 py-2 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet ${item.id === section ? "border-violet/70 bg-violet/20 text-ink" : "border-white/10 text-muted transition-colors hover:bg-white/5 hover:text-ink"}`}>
              {item.title}
            </Link>
          ))}
        </nav>
        {children}
      </main>
      <Footer />
    </>
  );
}
