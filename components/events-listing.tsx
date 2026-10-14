import { EventCard } from "./content/event-card";
import { ContentEmpty } from "./content/content-empty";
import { classifyEvents } from "@/data/content";
import { getEventPhase } from "@/lib/event-display";

export function EventsListing({ now, headingLevel = 3 }: { now: number; headingLevel?: 2 | 3 }) {
  const Heading = headingLevel === 2 ? "h2" : "h3";
  const { upcoming, past: started } = classifyEvents(now);
  const groups = [
    { title: "Em andamento", events: started.filter((event) => getEventPhase(event, now) === "active") },
    { title: "Próximos eventos", events: upcoming },
    { title: "Eventos anteriores", events: started.filter((event) => getEventPhase(event, now) !== "active") },
  ];
  return <div className="space-y-8">{groups.map(({ title, events }) => <section key={title} aria-label={title}>
    <Heading className="text-lg font-extrabold text-ink">{title}</Heading>
    <div className="mt-4">{events.length ? <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{events.map((event) => <EventCard key={event.slug} event={event} now={now} />)}</div> : <ContentEmpty title="Nenhum evento nesta categoria" description="Acompanhe as novidades aqui e no Discord da comunidade." />}</div>
  </section>)}</div>;
}
