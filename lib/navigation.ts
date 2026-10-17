export type NavigationItem = {
  href: string;
  label: string;
  external?: boolean;
  activePaths?: string[];
};

export type NavigationGroup = {
  label: string;
  items: NavigationItem[];
};

// The first subtopic is also the main section's destination.
export const navigationGroups: NavigationGroup[] = [
  { label: "Jogar", items: [
    { href: "/play", label: "Como jogar" },
    { href: "/status", label: "Status" },
    { href: "/online", label: "Online" },
    { href: "/leaderboards", label: "Ranking" },
  ] },
  { label: "Loja", items: [
    { href: "/store", label: "VIPs", activePaths: ["/store", "/ranks"] },
  ] },
  { label: "Comunidade", items: [
    { href: "/community", label: "Visão geral" },
    { href: "/news", label: "Notícias" },
    { href: "/events", label: "Eventos" },
    { href: "/player", label: "Jogadores" },
    { href: "https://discord.gg/Bupp8tWvpu", label: "Discord", external: true },
  ] },
  { label: "Recursos", items: [
    { href: "/wiki", label: "Wiki" },
    { href: "/rules", label: "Regras" },
    { href: "/faq", label: "FAQ" },
  ] },
];

export function isNavigationItemActive(item: NavigationItem, pathname: string) {
  return !item.external && (item.activePaths ?? [item.href]).some(
    (path) => pathname === path || pathname.startsWith(`${path}/`),
  );
}

export function getNavigationGroup(pathname: string) {
  return navigationGroups.find((group) => group.items.some((item) => isNavigationItemActive(item, pathname)));
}
