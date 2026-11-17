import { ContentPage } from "@/components/content/content-page";
import { EventsListing } from "@/components/events-listing";
import { DiscordLink } from "@/components/discord-link";
import { publicPageMetadata } from "@/lib/seo";
import { classifyEvents } from "@/data/content";

export const metadata = publicPageMetadata("/events");

export default function EventsPage() {
  const { upcoming, past } = classifyEvents();
  const hasEvents = upcoming.length > 0 || past.length > 0;
  const now = new Date().getTime();
  return <ContentPage active="/news" title="Eventos" description="Eventos oficiais da Swift MC serão publicados aqui quando houver programação confirmada.">
    {hasEvents ? <EventsListing now={now} headingLevel={2} /> : <div className="content-panel p-6 sm:p-8">
      <p className="text-sm leading-6 text-muted">Ainda não há eventos confirmados para exibir. Acompanhe os avisos oficiais no Discord.</p>
      <div className="mt-6"><DiscordLink className="button-primary">Abrir Discord</DiscordLink></div>
    </div>}
  </ContentPage>;
}
