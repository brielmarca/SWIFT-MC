const unavailable = "Indisponível";

export function formatPlayerNumber(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value) || value < 0) return unavailable;
  return new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 8 }).format(value);
}

export function formatPlaytime(seconds: number | null | undefined): string {
  if (seconds == null || !Number.isSafeInteger(seconds) || seconds < 0) return unavailable;
  if (seconds < 60) return `${seconds} s`;
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return [days ? `${formatPlayerNumber(days)} d` : "", hours ? `${hours} h` : "", minutes ? `${minutes} min` : ""].filter(Boolean).join(" ");
}

export function formatPlayerTimestamp(value: string | null | undefined): string {
  if (!value || !Number.isFinite(Date.parse(value))) return unavailable;
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" }).format(new Date(value)) + " UTC";
}
