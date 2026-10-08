import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { NetworkPage } from "@/components/network-page";
import { NetworkState } from "@/components/network-ui";
import { ArrowLeft } from "lucide-react";
import { PlayerAvatar } from "@/components/player-avatar";
import { PlayerProfileActions, RetryPlayerProfile } from "@/components/player-profile-actions";
import { isJavaUsername } from "@/lib/minecraft-profile";
import { lookupMinecraftProfile } from "@/lib/minecraft-profile-server";
import { PlayerServerStats } from "@/components/player-server-stats";

type Props = { params: Promise<{ username: string }> };
export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { username } = await params;
  return { title: isJavaUsername(username) ? `${username} | Jogadores SWIFT MC` : "Perfil de jogador | SWIFT MC", description: "Perfil público do Minecraft Java. Consulte username, UUID e skin." };
}

export default async function PublicPlayerPage({ params }: Props) {
  const { username } = await params;
  const result = await lookupMinecraftProfile(username);
  if (result.status !== "found") {
    const messages = {
      invalid: { title: "Nome inválido", description: "Use de 3 a 16 letras, números ou sublinhado (_), sem espaços ou acentos." },
      not_found: { title: "Jogador não encontrado", description: "Não encontramos um perfil Java com esse nome. Confira a escrita ou tente o nome atual: o jogador pode ter alterado o username." },
      unavailable: { title: "Perfil indisponível", description: "Não foi possível consultar o perfil agora. Tente novamente em alguns instantes; isso não significa que a conta não existe." },
    };
    const message = messages[result.status];
    return <NetworkPage active="/player" title="Perfil do jogador" description="Identidade Minecraft e trajetória na SwiftMC.">
      <NetworkState kind={result.status === "not_found" ? "empty" : "error"} title={message.title} description={message.description}>
        <div className="flex flex-wrap justify-center gap-3"><Link href="/player" className="network-action">Buscar outro jogador</Link>{result.status !== "invalid" && <RetryPlayerProfile />}</div>
      </NetworkState>
      {result.status !== "invalid" && <p className="mt-5 text-xs leading-5 text-muted">A consulta pode usar cache de até 30 segundos. Busque pelo nome atual da conta.</p>}
    </NetworkPage>;
  }
  const { profile } = result;
  if (username !== profile.username) redirect(`/player/${profile.username}`);

  return <NetworkPage active="/player" title="Perfil do jogador" description="Identidade Minecraft e trajetória na SwiftMC.">
    <Link href="/player" className="network-action mb-6"><ArrowLeft size={16} aria-hidden="true" />Buscar outro jogador</Link>
    <div className="grid items-start gap-6 lg:grid-cols-12">
      <section className="network-panel min-w-0 border-violet/25 bg-gradient-to-br from-violet/10 to-transparent p-5 sm:p-6 lg:col-span-8" aria-labelledby="profile-identity-title">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center"><PlayerAvatar key={profile.uuid} profile={profile} size="lg" /><div className="min-w-0"><p className="micro-label">Minecraft Java</p><h2 id="profile-identity-title" className="mt-2 break-all text-2xl font-extrabold tracking-tight text-ink sm:text-3xl">{profile.username}</h2><p className="mt-2 text-sm text-muted">Perfil público do jogador</p></div></div>
        <PlayerProfileActions uuid={profile.uuid} username={profile.username} />
        <dl className="mt-5 border-t border-white/10 pt-5"><dt className="micro-label">UUID · Identificador da conta</dt><dd className="mt-2 break-all font-mono text-xs leading-6 text-muted">{profile.uuid}</dd></dl>
        <p className="mt-4 text-xs leading-5 text-muted">Esta conta Java não confirma participação na SwiftMC. A identidade pode usar cache de até 5 minutos.</p>
      </section>
      <section className="min-w-0 lg:col-span-4" aria-label="Visual do jogador"><PlayerAvatar key={profile.uuid} profile={profile} body /></section>
    </div>
    <PlayerServerStats key={profile.uuid} username={profile.username} uuid={profile.uuid} />
  </NetworkPage>;
}
