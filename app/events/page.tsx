import type { Metadata } from "next";
import { EventCard } from "@/components/content/event-card";
import { PlayerPage } from "@/components/player-page";
import { classifyEvents } from "@/data/content";
import { CONTENT_TIMEZONE_LABEL } from "@/lib/content-format";

// Upcoming/past classification depends on the current date and time.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Eventos | SWIFT MC",
  description: "Próximos eventos e atividades da comunidade do servidor SWIFT MC, com data, horário e local.",
};

export default function EventsPage() {
  const { upcoming, past } = classifyEvents();
  return (
    <PlayerPage
      eyebrow="Eventos"
      title="Eventos do servidor"
      description={`Torneios, encontros e atividades da comunidade. Os horários são exibidos em ${CONTENT_TIMEZONE_LABEL}.`}
    >
      <section aria-labelledby="upcoming-events-title">
        <h2 id="upcoming-events-title" className="text-2xl font-bold text-ink">Próximos eventos</h2>
        {upcoming.length > 0 ? (
          <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {upcoming.map((event) => <EventCard key={event.slug} event={event} />)}
          </div>
        ) : (
          <div className="glass-panel mt-6 p-8 text-center">
            <p className="text-base font-bold text-ink">Nenhum evento programado no momento</p>
            <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-muted">Novas atividades serão anunciadas aqui e no Discord assim que tiverem data definida. Nenhuma contagem regressiva é exibida sem uma data confirmada.</p>
          </div>
        )}
      </section>

      <section aria-labelledby="past-events-title" className="mt-14 border-t border-white/[0.06] pt-10">
        <h2 id="past-events-title" className="text-2xl font-bold text-ink">Eventos encerrados</h2>
        {past.length > 0 ? (
          <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {past.map((event) => <EventCard key={event.slug} event={event} past />)}
          </div>
        ) : (
          <p className="mt-4 text-sm leading-6 text-muted">Ainda não há eventos encerrados para exibir.</p>
        )}
      </section>
    </PlayerPage>
  );
}
