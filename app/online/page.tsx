import { publicPageMetadata } from "@/lib/seo";
import { OnlinePlayers } from "@/components/online-players";
import { NetworkPage } from "@/components/network-page";

export const metadata = publicPageMetadata("/online");

export default function OnlinePage() {
  return <NetworkPage active="/online" title="Jogadores online" description="Veja quem está na rede, encontre seus amigos e explore os perfis dos jogadores.">
    <OnlinePlayers />
  </NetworkPage>;
}
