import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { BRAND_IMAGE, createPageMetadata, getSiteUrl, PUBLIC_PAGES, publicPageMetadata, rootMetadata, siteUrl } from "@/lib/seo";
import sitemap from "@/app/sitemap";
import robots from "@/app/robots";
import manifest from "@/app/manifest";
import { ranks } from "@/data/ranks";
import { getPublishedGuides } from "@/data/wiki";
import { getPublishedNews, newsPosts } from "@/data/content";

test("canonical origin rejects local, private, malformed and credential-bearing configuration", () => {
  for (const value of ["", "not a URL", "http://swiftmc.com.br", "https:swiftmc.com.br", "https://localhost", "https://app.localhost", "https://127.0.0.1", "https://2130706433", "https://10.0.0.1", "https://[::1]", "https://intranet", "https://app.internal", "https://app.local", "https://user:secret@swiftmc.com.br", "https://swiftmc.com.br:3000", "https://swiftmc.com.br/path", "https://swiftmc.com.br?token=secret", "https://swiftmc.com.br/#fragment", "https://swiftmc.com.br\\@other.com", "https://swift\nmc.com.br"]) {
    assert.equal(getSiteUrl(value).href, "https://swiftmc.com.br/", value);
  }
  assert.equal(getSiteUrl(" https://www.swiftmc.com.br/ ").href, "https://www.swiftmc.com.br/");
  assert.deepEqual(rootMetadata.title, { default: "SwiftMC", template: "%s | SwiftMC" });
  assert.deepEqual(publicPageMetadata("/").title, { absolute: "Survival Minecraft | SwiftMC" });
});

test("configured origin is used consistently without losing dynamic route segments", (context) => {
  const original = process.env.NEXT_PUBLIC_SITE_URL;
  context.after(() => {
    if (original === undefined) delete process.env.NEXT_PUBLIC_SITE_URL;
    else process.env.NEXT_PUBLIC_SITE_URL = original;
  });
  process.env.NEXT_PUBLIC_SITE_URL = "https://www.swiftmc.com.br";
  const metadata = createPageMetadata({ title: "Comandos essenciais", description: "Guia de comandos", path: "/wiki/comandos-essenciais", type: "article" });
  assert.equal(metadata.alternates?.canonical, "https://www.swiftmc.com.br/wiki/comandos-essenciais");
  assert.equal(metadata.openGraph?.url, metadata.alternates?.canonical);
  assert.equal(metadata.openGraph?.title, "Comandos essenciais | SwiftMC");
  assert.equal(metadata.twitter?.title, metadata.openGraph?.title);
  assert.equal(siteUrl("/player/Player_123"), "https://www.swiftmc.com.br/player/Player_123");
  assert.equal(robots().sitemap, "https://www.swiftmc.com.br/sitemap.xml");
  assert.ok(sitemap().every(({ url }) => url.startsWith("https://www.swiftmc.com.br/")));
  assert.throws(() => siteUrl("//other.example.com/"));
  assert.throws(() => siteUrl("/\\other.example.com/"));
  assert.throws(() => siteUrl("/\n/other.example.com/"));
});

test("sitemap includes public routes and only published local dynamic content", (context) => {
  context.mock.timers.enable({ apis: ["Date"], now: new Date("2026-09-20T00:00:00Z") });
  const entries = sitemap();
  const paths = entries.map(({ url }) => new URL(url).pathname);
  assert.equal(new Set(paths).size, paths.length);
  assert.deepEqual(paths, [
    ...Object.keys(PUBLIC_PAGES),
    ...ranks.map(({ slug }) => `/ranks/${slug}`),
    ...getPublishedGuides().map(({ slug }) => `/wiki/${slug}`),
    ...getPublishedNews().map(({ slug }) => `/news/${slug}`),
  ]);
  for (const post of newsPosts.filter((post) => post.status === "draft" || Date.parse(post.publishedAt) > Date.now())) {
    assert.ok(!paths.includes(`/news/${post.slug}`));
  }
  assert.ok(paths.includes("/player"));
  assert.ok(!paths.some((path) => /^\/(?:player\/|api\/|checkout)/.test(path)));
  assert.ok(entries.every((entry) => entry.lastModified === undefined));
});

test("social metadata retains local article artwork and publication date", () => {
  const post = getPublishedNews().find((post) => post.image)!;
  const metadata = createPageMetadata({ title: post.title, description: post.excerpt, path: `/news/${post.slug}`, type: "article", image: post.image, publishedTime: post.publishedAt });
  assert.equal(metadata.openGraph && "publishedTime" in metadata.openGraph && metadata.openGraph.publishedTime, post.publishedAt);
  assert.equal(metadata.openGraph?.description, post.excerpt);
  assert.ok(JSON.stringify(metadata.openGraph?.images).includes(siteUrl(post.image!.src)));
  const unavailable = createPageMetadata({ title: "Perfil de jogador", description: "Perfil público do Minecraft Java.", index: false });
  assert.deepEqual(unavailable.robots, { index: false, follow: true });
  assert.equal(unavailable.alternates, undefined);
  assert.ok(JSON.stringify(unavailable.twitter).includes(siteUrl(BRAND_IMAGE.src)));
});

test("manifest references existing artwork with its actual dimensions and robots allows noindex discovery", () => {
  const identity = manifest();
  assert.equal(identity.name, "SwiftMC");
  assert.equal(identity.start_url, "/");
  assert.equal(identity.theme_color, "#7c3aed");
  const png = readFileSync(new URL(`../public${BRAND_IMAGE.src}`, import.meta.url));
  assert.equal(identity.icons?.[0].sizes, `${png.readUInt32BE(16)}x${png.readUInt32BE(20)}`);
  assert.deepEqual(robots().rules, { userAgent: "*", allow: "/", disallow: ["/api/"] });
});
