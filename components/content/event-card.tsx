import { CalendarClock, MapPin, Tags } from "lucide-react";
import type { EventPost } from "@/data/content";
import { CONTENT_TIMEZONE_LABEL, formatEventDay, formatEventRange } from "@/lib/content-format";
import { DiscordLink } from "../discord-link";
import { getEventPhase } from "@/lib/event-display";

export function EventCard({ event, now }: { event: EventPost; now: number }) {
  const startDay = formatEventDay(event.startsAt);
  const phase = getEventPhase(event, now);
  const past = phase === "ended" || phase === "past";
  const labels = { upcoming: "Em breve", active: "Em andamento", ended: "Encerrado", past: "Data passada", unknown: "Data indisponível" };
  const validEnd = event.endsAt && Number.isFinite(Date.parse(event.endsAt)) && Date.parse(event.endsAt) >= Date.parse(event.startsAt) ? event.endsAt : undefined;
  return (
    <article className={`content-panel flex h-full flex-col p-5 ${phase === "active" ? "border-violet/50 bg-gradient-to-br from-violet/15 to-card" : past ? "bg-void/50" : ""}`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className={`inline-flex items-center gap-2 text-xs font-extrabold uppercase tracking-wider ${past ? "text-muted" : "text-ultraviolet"}`}>
          <CalendarClock size={15} aria-hidden="true" />
          {labels[phase]}
        </p>
      </div>
      <time dateTime={event.startsAt} className="mt-4 block border-l-2 border-violet/40 pl-3 text-sm font-bold text-ink">{startDay}</time>
      <h3 className="mt-4 text-lg font-extrabold leading-6 text-ink">{event.title}</h3>
      <p className="mt-3 flex-1 text-sm leading-6 text-muted">{event.description}</p>
      <div className="mt-4 border-t border-white/10 pt-3 text-xs leading-5">
        <p className="font-bold tabular-nums text-ink">{formatEventRange(event.startsAt)}</p>
        {validEnd && <p className="mt-1 text-muted">Até <time dateTime={validEnd}>{formatEventRange(validEnd)}</time></p>}
        <p className="mt-1 text-muted">{CONTENT_TIMEZONE_LABEL}{phase === "past" ? " · Término não informado" : ""}</p>
      </div>
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
      {event.discordCta && (phase === "upcoming" || phase === "active") && (
        <div className="mt-5">
          <DiscordLink className="network-action w-full sm:w-auto">Combinar no Discord</DiscordLink>
        </div>
      )}
    </article>
  );
}
