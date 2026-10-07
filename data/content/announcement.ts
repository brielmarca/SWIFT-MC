import type { SiteAnnouncement } from "./types";

/** Builds an ISO 8601 instant `daysFromNow` days ahead, used for sample windows. */
function daysFromNowIso(days: number): string {
  return new Date(Date.now() + days * 86400000).toISOString();
}

/**
 * One optional site-wide announcement. Set to `null` to show nothing.
 * SAMPLE CONTENT — replace before production.
 */
export const siteAnnouncement: SiteAnnouncement | null = {
  id: "amostra-manutencao-outubro",
  title: "Manutenção programada",
  message: "O servidor ficará indisponível por até 2 horas neste sábado às 3h.",
  href: "/news/manutencao-programada",
  linkLabel: "Ver detalhes",
  startsAt: daysFromNowIso(-1),
  expiresAt: daysFromNowIso(30),
};
