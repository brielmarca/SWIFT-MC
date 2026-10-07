import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { PlayerPage } from "@/components/player-page";
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
    return <PlayerPage title={message.title} description={message.description}><section className="glass-panel max-w-3xl p-6"><div className="flex flex-wrap gap-3"><Link href="/player" className="button-primary">Buscar outro jogador</Link>{result.status !== "invalid" && <RetryPlayerProfile />}</div>{result.status !== "invalid" && <p className="mt-4 text-sm leading-6 text-muted">Resultados indisponíveis ou não encontrados podem permanecer em cache por até 30 segundos. Não mantemos histórico de nomes antigos.</p>}</section></PlayerPage>;
  }
  const { profile } = result;
  if (username !== profile.username) redirect(`/player/${profile.username}`);

  return <PlayerPage title={profile.username} description="Perfil público do Minecraft Java. A existência desta conta não confirma participação no servidor SWIFT MC.">
    <Link href="/player" className="button-secondary mb-6">Buscar outro jogador</Link>
    <div className="grid items-start gap-6 lg:grid-cols-12">
      <section className="glass-panel min-w-0 p-5 sm:p-8 lg:col-span-8" aria-labelledby="profile-identity-title">
        <div className="flex items-center gap-4"><PlayerAvatar key={profile.uuid} profile={profile} /><div className="min-w-0"><h2 id="profile-identity-title" className="text-sm font-bold uppercase tracking-wide text-muted">Perfil Java</h2><p className="mt-1 break-all text-2xl font-extrabold text-ink">{profile.username}</p></div></div>
        <dl className="mt-6"><dt className="micro-label">UUID</dt><dd className="mt-2 break-all font-mono text-sm leading-6 text-ultraviolet">{profile.uuid}</dd></dl>
        <PlayerProfileActions uuid={profile.uuid} username={profile.username} />
        <p className="mt-4 text-xs leading-5 text-muted">Perfis podem usar cache de até 5 minutos. Se o jogador alterou o nome recentemente, busque novamente pelo nome atual.</p>
      </section>
      <section className="min-w-0 lg:col-span-4" aria-label="Visual do jogador"><PlayerAvatar key={profile.uuid} profile={profile} body /></section>
    </div>
    <PlayerServerStats key={profile.uuid} username={profile.username} uuid={profile.uuid} />
  </PlayerPage>;
}
