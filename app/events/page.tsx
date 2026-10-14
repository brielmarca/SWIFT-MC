import { connection } from "next/server";
import { publicPageMetadata } from "@/lib/seo";
import { ContentPage } from "@/components/content/content-page";
import { EventsListing } from "@/components/events-listing";
import { CONTENT_TIMEZONE_LABEL } from "@/lib/content-format";

export const dynamic = "force-dynamic";
export const metadata = publicPageMetadata("/events");

async function loadSnapshot() {
  await connection();
  return Date.now();
}

export default async function EventsPage() {
  const now = await loadSnapshot();
  return <ContentPage active="/events" title="Eventos do servidor" description={`Torneios, encontros e atividades da comunidade. Os horários são exibidos em ${CONTENT_TIMEZONE_LABEL}.`}>
    <EventsListing now={now} headingLevel={2} />
  </ContentPage>;
}
