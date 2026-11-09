import Link from "next/link";
import { ContentPage } from "@/components/content/content-page";
import { publicPageMetadata } from "@/lib/seo";

export const metadata = publicPageMetadata("/status");

export default function PlayerUnavailablePage() {
  return <ContentPage active="/news" title="Busca de jogadores indisponível" description="A busca pública de perfis de jogadores está desativada nesta fase.">
    <div className="content-panel p-6 sm:p-8">
      <p className="text-sm leading-6 text-muted">Para informações do servidor, use a página de Status. Para novidades e guias, consulte Notícias e Wiki.</p>
      <div className="mt-6 flex flex-wrap gap-3">
        <Link href="/status" className="button-primary">Ver status</Link>
        <Link href="/news" className="button-secondary">Ver notícias</Link>
      </div>
    </div>
  </ContentPage>;
}
