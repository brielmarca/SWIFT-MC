import { publicPageMetadata } from "@/lib/seo";
import { connection } from "next/server";
import { EventCard } from "@/components/content/event-card";
import { ContentPage } from "@/components/content/content-page";
import { ContentEmpty } from "@/components/content/content-empty";
import { classifyEvents } from "@/data/content";
import { CONTENT_TIMEZONE_LABEL } from "@/lib/content-format";
import { getEventPhase } from "@/lib/event-display";

// Upcoming/past classification depends on the current date and time.
export const dynamic = "force-dynamic";

export const metadata = publicPageMetadata("/events");

// Read the clock once while loading request-scoped data, then render that snapshot.
async function loadEventSnapshot() {
  await connection();
  const now = Date.now();
  return { now, ...classifyEvents(now) };
}

export default async function EventsPage() {
  const { now, upcoming, past: started } = await loadEventSnapshot();
  const active = started.filter((event) => getEventPhase(event, now) === "active");
  const past = started.filter((event) => getEventPhase(event, now) !== "active");
  return (
    <ContentPage
      active="/events"
      title="Eventos do servidor"
      description={`Torneios, encontros e atividades da comunidade. Os horários são exibidos em ${CONTENT_TIMEZONE_LABEL}.`}
    >
      {active.length > 0 && <section aria-labelledby="active-events-title" className="mb-8">
        <h2 id="active-events-title" className="text-lg font-extrabold text-ultraviolet">Em andamento</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{active.map((event) => <EventCard key={event.slug} event={event} now={now} />)}</div>
      </section>}
      <section aria-labelledby="upcoming-events-title">
        <h2 id="upcoming-events-title" className="text-lg font-extrabold text-ink">Próximos eventos</h2>
        {upcoming.length > 0 ? (
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {upcoming.map((event) => <EventCard key={event.slug} event={event} now={now} />)}
          </div>
        ) : (
          <div className="mt-4"><ContentEmpty title="Nenhum evento programado no momento" description="Novas atividades serão anunciadas aqui e no Discord assim que tiverem data definida." /></div>
        )}
      </section>

      <section aria-labelledby="past-events-title" className="mt-8 border-t border-white/10 pt-6">
        <h2 id="past-events-title" className="text-lg font-extrabold text-ink">Eventos anteriores</h2>
        {past.length > 0 ? (
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {past.map((event) => <EventCard key={event.slug} event={event} now={now} />)}
          </div>
        ) : (
          <div className="mt-4"><ContentEmpty title="Nenhum evento anterior" description="Os eventos com datas passadas aparecerão aqui." /></div>
        )}
      </section>
    </ContentPage>
  );
}
