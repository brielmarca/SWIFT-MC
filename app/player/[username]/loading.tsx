import { NetworkPage } from "@/components/network-page";
import { NetworkState } from "@/components/network-ui";

export default function LoadingPlayer() {
  return <NetworkPage active="/player" title="Perfil do jogador" description="Identidade Minecraft e trajetória na SwiftMC."><NetworkState kind="loading" title="Buscando perfil" description="Consultando o nome e o visual da conta Minecraft Java." /></NetworkPage>;
}
