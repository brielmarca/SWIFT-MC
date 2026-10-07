// Centralized formatting for news, events and announcements (pt-BR, Brasília time).

export const CONTENT_TIMEZONE = "America/Sao_Paulo";
export const CONTENT_TIMEZONE_LABEL = "Horário de Brasília";

const unavailable = "Data indisponível";

function parse(value: string | null | undefined): Date | null {
  if (!value) return null;
  const time = Date.parse(value);
  return Number.isFinite(time) ? new Date(time) : null;
}

/** "28 de setembro de 2026" */
export function formatNewsDate(value: string | null | undefined): string {
  const date = parse(value);
  if (!date) return unavailable;
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "long", timeZone: CONTENT_TIMEZONE }).format(date);
}

/** "28 de set. de 2026" — compact form for cards. */
export function formatNewsShortDate(value: string | null | undefined): string {
  const date = parse(value);
  if (!date) return unavailable;
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium", timeZone: CONTENT_TIMEZONE }).format(date);
}

/** "sáb., 10 de out. de 2026" */
export function formatEventDay(value: string | null | undefined): string {
  const date = parse(value);
  if (!date) return unavailable;
  return new Intl.DateTimeFormat("pt-BR", { weekday: "short", day: "numeric", month: "short", year: "numeric", timeZone: CONTENT_TIMEZONE }).format(date);
}

/** "19:00" */
export function formatClockTime(value: string | null | undefined): string {
  const date = parse(value);
  if (!date) return unavailable;
  return new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: CONTENT_TIMEZONE }).format(date);
}

/** "10 de out. de 2026 · 19:00–22:00" (end time only when a valid endsAt exists). */
export function formatEventRange(startsAt: string, endsAt?: string): string {
  const start = parse(startsAt);
  if (!start) return unavailable;
  const day = new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium", timeZone: CONTENT_TIMEZONE }).format(start);
  const open = formatClockTime(startsAt);
  const end = endsAt && endsAt !== startsAt ? formatClockTime(endsAt) : null;
  if (end && end !== unavailable) return `${day} · ${open}–${end}`;
  return `${day} · ${open}`;
}
