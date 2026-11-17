import Link from "next/link";
import { NetworkPage } from "@/components/network-page";
import { publicPageMetadata } from "@/lib/seo";

export const metadata = publicPageMetadata("/status");

export default function LeaderboardsPage() {
  return <NetworkPage active="/status" title="Ranking indisponível" description="Os rankings públicos serão exibidos quando houver dados oficiais disponíveis para publicação.">
    <div className="content-panel p-6 sm:p-8">
      <p className="text-sm leading-6 text-muted">Enquanto isso, você pode acompanhar o status do servidor e as notícias oficiais.</p>
      <div className="mt-6 flex flex-wrap gap-3">
        <Link href="/status" className="button-primary">Ver status</Link>
        <Link href="/news" className="button-secondary">Ver notícias</Link>
      </div>
    </div>
  </NetworkPage>;
}
