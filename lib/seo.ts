import "server-only";
import type { Metadata } from "next";

export const SITE_NAME = "Swift MC";
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
  src: "/brand/emblem.webp",
  alt: "Emblema roxo oficial da Swift MC",
  width: 1200,
  height: 1090,
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
  "/play": { title: "Como jogar", description: "Endereço, status e instruções para entrar no servidor Minecraft Java 1.21.11 da Swift MC." },
  "/store": { title: "Loja de ranks", description: "Compare os VIPs mensais Swift, Eclipse, Cosmic e Overdrive da rede Swift MC." },
  "/status": { title: "Status e conexão", description: "Consulte status, jogadores online e conexão do servidor Minecraft Java 1.21.11 Swift MC em swiftmc.com.br." },
  "/lore": { title: "Lore", description: "Lore oficial da Swift MC, publicada quando houver material confirmado pela equipe." },
  "/vote": { title: "Votar", description: "Links de votação da Swift MC serão publicados quando houver confirmação oficial da equipe." },
  "/privacy": { title: "Política de privacidade", description: "Estrutura da política de privacidade da Swift MC. Texto final pendente de aprovação." },
  "/terms": { title: "Termos de compra", description: "Estrutura dos termos de compra da Swift MC. Texto final pendente de aprovação." },
  "/refund": { title: "Política de reembolso", description: "Estrutura da política de reembolso da Swift MC. Texto final pendente de aprovação." },



  "/wiki": { title: "Wiki e guias", description: "Guias do servidor Swift MC: primeiros passos, Survival, economia, comandos e ranks." },
  "/news": { title: "Notícias", description: "Notícias e avisos oficiais do servidor Swift MC." },

  "/events": { title: "Eventos", description: "Eventos oficiais da comunidade Swift MC, quando houver programação confirmada." },
  "/rules": { title: "Regras do servidor e Discord", description: "Consulte os regulamentos oficiais do servidor Minecraft e do Discord Swift MC, com busca por assunto ou ID e navegação por seções." },
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
  title: { default: SITE_NAME, template: "%s | Swift MC" },
  applicationName: SITE_NAME,
  manifest: "/manifest.webmanifest",
  icons: { icon: { url: BRAND_IMAGE.src, type: "image/webp" }, apple: BRAND_IMAGE.src },
};
