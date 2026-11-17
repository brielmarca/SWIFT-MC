import type { Metadata } from "next";
import { ContentPage } from "@/components/content/content-page";
import { DiscordLink } from "@/components/discord-link";
import { createPageMetadata } from "@/lib/seo";

export const metadata: Metadata = createPageMetadata({
  title: "Lore",
  description: "Lore oficial da Swift MC. Conteúdos narrativos serão publicados quando houver material confirmado pela equipe.",
  path: "/lore",
});

export default function LorePage() {
  return <ContentPage active="/lore" title="Lore da Swift MC" description="A história oficial do servidor será publicada aqui quando houver material confirmado pela equipe.">
    <div className="grid gap-4 lg:grid-cols-2">
      <section className="content-panel p-6 sm:p-8">
        <p className="eyebrow">Em preparação</p>
        <h2 className="page-heading mt-3">Conteúdo aguardando aprovação</h2>
        <p className="mt-4 text-sm leading-6 text-muted">Esta página está reservada para a lore oficial da Swift MC. Personagens, eventos, regiões e capítulos só serão publicados com confirmação da equipe do projeto.</p>
      </section>
      <section className="content-panel border-violet/25 bg-gradient-to-br from-violet/10 to-transparent p-6 sm:p-8">
        <p className="eyebrow">Acompanhe</p>
        <h2 className="page-heading mt-3">Avisos oficiais</h2>
        <p className="mt-4 text-sm leading-6 text-muted">Novidades confirmadas serão comunicadas pelas notícias e pelo Discord.</p>
        <div className="mt-6"><DiscordLink className="button-primary">Abrir Discord</DiscordLink></div>
      </section>
    </div>
  </ContentPage>;
}
