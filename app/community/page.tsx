import { ContentPage } from "@/components/content/content-page";
import { NewsListing } from "@/components/news-listing";
import { EventsListing } from "@/components/events-listing";
import { OnlinePlayers } from "@/components/online-players";
import { getPublishedNews } from "@/data/content";
import { publicPageMetadata } from "@/lib/seo";
import { CONTENT_TIMEZONE_LABEL } from "@/lib/content-format";

export const dynamic = "force-dynamic";
export const metadata = publicPageMetadata("/community");

async function loadSnapshot() {
  const now = Date.now();
  const posts = getPublishedNews(now);
  return { now, posts };
}

export default async function CommunityPage() {
  const { now, posts } = await loadSnapshot();
  const publishedNews = posts.slice(0, 3);

  return (
    <ContentPage active="/community" title="SwiftMC Community" description="Notícias, eventos e encontros da comunidade SwiftMC em um só lugar.">
      <header className="mb-12">
        <div className="border-l-2 border-violet pl-4 sm:pl-5">
          <p className="eyebrow">Comunidade SwiftMC</p>
          <h2 className="page-title mt-2">Bem-vindo à comunidade</h2>
          <p className="page-description mt-2 text-base leading-7 text-muted">
            Fique por dentro das novidades, encontre jogadores online e descubra eventos da SwiftMC.
          </p>
        </div>
      </header>

      <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
        <div className="space-y-6">
          <OnlinePlayers />
          <NewsListing posts={publishedNews} />
        </div>

        <div className="space-y-6">
          <EventsListing now={now} headingLevel={3} />
          <div>
            <h3 className="micro-label">Descoberta da comunidade</h3>
            <div className="grid grid-cols-2 gap-2">
              <a
                href="/player"
                className="flex min-h-11 items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-ultraviolet hover:bg-white/5 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet"
              >
                <span>Jogadores</span>
              </a>
              <a
                href="/leaderboards"
                className="flex min-h-11 items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-ultraviolet hover:bg-white/5 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet"
              >
                <span>Ranking</span>
              </a>
            </div>
          </div>
        </div>
      </div>

      <section id="news" className="mt-12 scroll-mt-24 border-t border-white/10 pt-10">
        <h2 id="news-title" className="page-heading mb-6">Últimas notícias</h2>
        <NewsListing posts={posts} />
      </section>

      <section id="events" className="mt-12 scroll-mt-24 border-t border-white/10 pt-10">
        <h2 id="events-title" className="page-heading">Eventos da comunidade</h2>
        <p className="mb-6 mt-3 text-sm text-muted">Horários em {CONTENT_TIMEZONE_LABEL}.</p>
        <EventsListing now={now} />
      </section>
    </ContentPage>
  );
}