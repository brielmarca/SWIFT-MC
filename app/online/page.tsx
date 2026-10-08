import type { Metadata } from "next";
import { OnlinePlayers } from "@/components/online-players";
import { NetworkPage } from "@/components/network-page";

export const metadata: Metadata = {
  title: "Online | SWIFT MC",
  description: "Veja quem está jogando agora no servidor SWIFT MC com a lista de jogadores online informada pela API do servidor.",
};

export default function OnlinePage() {
  return <NetworkPage active="/online" title="Jogadores online" description="Veja quem está na rede, encontre seus amigos e explore os perfis dos jogadores.">
    <OnlinePlayers />
  </NetworkPage>;
}
