import { CalendarClock, MapPin, Tags } from "lucide-react";
import type { EventPost } from "@/data/content";
import { CONTENT_TIMEZONE_LABEL, formatEventDay, formatEventRange } from "@/lib/content-format";
import { DiscordLink } from "../discord-link";

export function EventCard({ event, past = false }: { event: EventPost; past?: boolean }) {
  const startDay = formatEventDay(event.startsAt);
  return (
    <article className={`feature-card flex h-full flex-col ${past ? "opacity-75" : ""}`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="inline-flex items-center gap-2 text-xs font-extrabold uppercase tracking-[0.12em] text-ultraviolet">
          <CalendarClock size={15} aria-hidden="true" />
          {past ? "Encerrado" : "Próximo evento"}
        </p>
        <span className="micro-label">{CONTENT_TIMEZONE_LABEL}</span>
      </div>
      <time dateTime={event.startsAt} className="mt-4 block text-sm font-bold text-ink">{startDay}</time>
      <h3 className="mt-2 text-xl font-bold leading-7 text-ink">{event.title}</h3>
      <p className="mt-3 flex-1 text-sm leading-6 text-muted">{event.description}</p>
      <p className="mt-4 text-sm font-bold tabular-nums text-ultraviolet">{formatEventRange(event.startsAt, event.endsAt)}</p>
      {(event.location || event.mode) && (
        <ul className="mt-4 flex flex-wrap gap-2" aria-label="Detalhes">
          {event.location && (
            <li className="inline-flex items-center gap-1.5 rounded-md border border-white/[0.07] bg-white/[0.04] px-2.5 py-1 text-xs text-muted">
              <MapPin size={13} aria-hidden="true" /> {event.location}
            </li>
          )}
          {event.mode && (
            <li className="inline-flex items-center gap-1.5 rounded-md border border-white/[0.07] bg-white/[0.04] px-2.5 py-1 text-xs text-muted">
              <Tags size={13} aria-hidden="true" /> {event.mode}
            </li>
          )}
        </ul>
      )}
      {event.discordCta && !past && (
        <div className="mt-5">
          <DiscordLink className="button-secondary w-full sm:w-auto">Combinar no Discord</DiscordLink>
        </div>
      )}
    </article>
  );
}
