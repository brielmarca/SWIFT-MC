import { connection } from "next/server";
import { ContentPage } from "@/components/content/content-page";
import { NewsListing } from "@/components/news-listing";
import { EventsListing } from "@/components/events-listing";
import { DiscordLink } from "@/components/discord-link";
import { getPublishedNews } from "@/data/content";
import { publicPageMetadata } from "@/lib/seo";
import { CONTENT_TIMEZONE_LABEL } from "@/lib/content-format";

export const dynamic = "force-dynamic";
export const metadata = publicPageMetadata("/community");

async function loadSnapshot() {
  await connection();
  const now = Date.now();
  return { now, posts: getPublishedNews(now) };
}

export default async function CommunityPage() {
  const { now, posts } = await loadSnapshot();
  return <ContentPage active="/community" title="Notícias & Eventos" description="Novidades, atualizações e encontros da comunidade SwiftMC em um só lugar.">
    <nav aria-label="Seções da comunidade" className="mb-8 flex flex-wrap gap-3"><a href="#news" className="button-secondary">Notícias</a><a href="#events" className="button-secondary">Eventos</a><DiscordLink className="button-primary">Entrar no Discord</DiscordLink></nav>
    <section id="news" className="scroll-mt-24" aria-labelledby="news-title"><h2 id="news-title" className="page-heading mb-6">Últimas notícias</h2><NewsListing posts={posts} /></section>
    <section id="events" className="mt-12 scroll-mt-24 border-t border-white/10 pt-10" aria-labelledby="events-title"><h2 id="events-title" className="page-heading">Eventos da comunidade</h2><p className="mb-6 mt-3 text-sm text-muted">Horários em {CONTENT_TIMEZONE_LABEL}.</p><EventsListing now={now} /></section>
  </ContentPage>;
}
