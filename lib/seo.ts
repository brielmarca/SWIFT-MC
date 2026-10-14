import "server-only";
import type { Metadata } from "next";

export const SITE_NAME = "SwiftMC";
export const SITE_DESCRIPTION = "Rede brasileira de Minecraft Survival com economia, proteção de terrenos e uma comunidade ativa.";
const DEFAULT_SITE_URL = "https://swiftmc.com.br";

/** Public HTTPS origin only; never inferred from request or deployment headers. */
export function getSiteUrl(value = process.env.NEXT_PUBLIC_SITE_URL): URL {
  try {
    const raw = value?.trim() || "";
    if (!/^https:\/\//i.test(raw) || /[\s\\]/.test(raw)) throw new Error("Invalid site URL");
    const url = new URL(raw);
    const publicHostname = /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/i;
    if (url.username || url.password || url.port || url.pathname !== "/" || url.search || url.hash
      || !publicHostname.test(url.hostname)
      || /\.(?:localhost|local|internal|test|invalid|example)$/i.test(url.hostname)) {
      throw new Error("Invalid site origin");
    }
    return new URL(url.origin);
  } catch {
    return new URL(DEFAULT_SITE_URL);
  }
}

export function siteUrl(path: string): string {
  if (!path.startsWith("/") || path.startsWith("//") || path.includes("\\")) {
    throw new Error("Metadata paths must be site-relative");
  }
  const origin = getSiteUrl();
  const url = new URL(path, origin);
  if (url.origin !== origin.origin) throw new Error("Metadata URLs must stay on the site origin");
  return url.href;
}

export const BRAND_IMAGE = {
  src: "/brand/emblem.png",
  alt: "Emblema roxo oficial da SwiftMC",
  width: 1316,
  height: 1195,
} as const;

type PageMetadata = {
  title: string;
  description: string;
  path?: string;
  image?: { src: string; alt: string; width?: number; height?: number };
  type?: "website" | "article";
  publishedTime?: string;
  index?: boolean;
};

export function createPageMetadata({ title, description, path, image = BRAND_IMAGE, type = "website", publishedTime, index = true }: PageMetadata): Metadata {
  const socialTitle = title === SITE_NAME ? title : `${title} | ${SITE_NAME}`;
  const url = path ? siteUrl(path) : undefined;
  const preview = { url: siteUrl(image.src), alt: image.alt, width: image.width, height: image.height };
  return {
    title,
    description,
    ...(url ? { alternates: { canonical: url } } : {}),
    ...(!index ? { robots: { index: false, follow: true } } : {}),
    openGraph: {
      type,
      siteName: SITE_NAME,
      locale: "pt_BR",
      title: socialTitle,
      description,
      ...(url ? { url } : {}),
      ...(type === "article" && publishedTime ? { publishedTime } : {}),
      images: [preview],
    },
    twitter: {
      // Existing brand artwork is nearly square, not a fabricated wide banner.
      card: "summary",
      title: socialTitle,
      description,
      images: [{ url: preview.url, alt: preview.alt }],
    },
  };
}

export const PUBLIC_PAGES = {
  "/": { title: "Survival Minecraft", description: SITE_DESCRIPTION },
  "/play": { title: "Como jogar", description: "Endereço, status e instruções para entrar no servidor Minecraft Java SwiftMC." },
  "/store": { title: "Loja de ranks", description: "Compare as assinaturas VIP mensais Swift, Eclipse, Cosmic e Overdrive da rede SwiftMC." },
  "/status": { title: "Status do servidor", description: "Consulte o status, jogadores e versão atual do servidor Minecraft SwiftMC." },
  "/online": { title: "Jogadores online", description: "Veja quem está jogando na SwiftMC com a lista de jogadores online informada pelo servidor." },
  "/leaderboards": { title: "Ranking do servidor", description: "Confira o ranking de tempo de jogo, abates e coins do servidor SwiftMC." },
  "/player": { title: "Jogadores", description: "Busque perfis públicos do Minecraft Java pelo nome do jogador." },
  "/wiki": { title: "Wiki e guias", description: "Guias do servidor SwiftMC: primeiros passos, Survival, economia, comandos e ranks." },
  "/news": { title: "Notícias", description: "Notícias, atualizações e avisos da comunidade do servidor SwiftMC." },
  "/community": { title: "Notícias & Eventos", description: "Todas as notícias, atualizações e eventos da comunidade SwiftMC em um só lugar." },
  "/events": { title: "Eventos", description: "Eventos e atividades da comunidade do servidor SwiftMC, com data, horário e local." },
  "/rules": { title: "Regras do servidor", description: "Consulte as regras de convivência, jogo justo e segurança da comunidade SwiftMC." },
  "/faq": { title: "Perguntas frequentes", description: "Tire suas dúvidas sobre o servidor, sua conta, VIPs e suporte." },
} as const;

export function publicPageMetadata(path: keyof typeof PUBLIC_PAGES): Metadata {
  const metadata = createPageMetadata({ ...PUBLIC_PAGES[path], path });
  // Next.js does not apply the root layout's template to its index page.
  // An absolute homepage title also avoids double branding in vinext.
  if (path === "/") metadata.title = { absolute: `${PUBLIC_PAGES[path].title} | ${SITE_NAME}` };
  return metadata;
}

export const rootMetadata: Metadata = {
  ...createPageMetadata({ title: SITE_NAME, description: SITE_DESCRIPTION }),
  metadataBase: getSiteUrl(),
  title: { default: SITE_NAME, template: "%s | SwiftMC" },
  applicationName: SITE_NAME,
  manifest: "/manifest.webmanifest",
  icons: { icon: { url: BRAND_IMAGE.src, type: "image/png" }, apple: BRAND_IMAGE.src },
};
