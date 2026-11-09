import type { Metadata } from "next";
import { publicPageMetadata } from "@/lib/seo";
import { ContentPage } from "@/components/content/content-page";

export const metadata: Metadata = publicPageMetadata("/vote");

export default function VotePage() {
  const discordUrl = process.env.NEXT_PUBLIC_DISCORD_URL;
  const safeDiscord = discordUrl && /^https:\/\//.test(discordUrl) ? discordUrl : null;
  return (
    <ContentPage active="/vote" title="Votar" description="Links de votação e recompensas só serão publicados quando houver confirmação oficial da equipe.">
      <div className="mx-auto max-w-3xl space-y-4">
        <div className="rounded-2xl border border-white/10 bg-void-light p-6 text-sm leading-7 text-text-secondary">
          <p className="font-semibold text-text-primary">Votação indisponível no momento</p>
          <p className="mt-2">Esta página evita links, recompensas ou servidores de votação não confirmados. Quando a equipe validar os portais oficiais, os links e eventuais benefícios serão publicados aqui.</p>
        </div>
        {safeDiscord ? <a className="inline-flex min-h-11 items-center text-sm font-semibold text-ultraviolet underline-offset-4 hover:underline" href={safeDiscord} rel="noopener noreferrer" target="_blank">Discord oficial</a> : null}
      </div>
    </ContentPage>
  );
}
