import Link from "next/link";
import { Link2, MailCheck } from "lucide-react";

/** Purchase guidance only. The checkout API independently enforces these requirements. */
export function CheckoutRequirements({ emailVerified, minecraftLinked }: { emailVerified: boolean; minecraftLinked: boolean }) {
  return <section role="status" aria-label="Verificação necessária para comprar" className="mb-6 rounded-xl border border-violet/30 bg-violet/10 p-5 sm:p-6">
    <h2 className="text-lg font-extrabold text-ink">Antes de pagar, confirme sua conta</h2>
    <p className="mt-2 text-sm leading-6 text-muted">VIPs e Cash são entregues exclusivamente à conta Minecraft Java verificada e vinculada à sua conta SwiftMC.</p>
    {!emailVerified && <div className="mt-4 space-y-2">
      <h3 className="flex items-center gap-2 font-bold text-ink"><MailCheck size={18} aria-hidden="true" />Primeiro: verifique seu e-mail</h3>
      <p className="text-sm text-muted">Acesse as configurações da sua conta, solicite o e-mail de confirmação e abra o link recebido. Sem isso, não é possível comprar.</p>
      <Link className="button-primary" href="/account/profile#email-verification">Verificar meu e-mail</Link>
    </div>}
    {!minecraftLinked && <div className="mt-5 space-y-3">
      <h3 className="flex items-center gap-2 font-bold text-ink"><Link2 size={18} aria-hidden="true" />Vincule sua conta Minecraft</h3>
      <ol className="list-decimal space-y-1 pl-5 text-sm leading-6 text-muted">
        <li>Entre em <strong className="text-ink">Minha conta → Configurações → Contas vinculadas</strong>.</li>
        <li>Clique em <strong className="text-ink">Gerar código de vínculo</strong> (válido por 15 minutos).</li>
        <li>Abra o Minecraft Java e entre no servidor <strong className="text-ink">swiftmc.com.br</strong>.</li>
        <li>No chat do jogo, digite <code className="font-semibold text-ink">/link CODIGO</code>, substituindo CODIGO pelo código recebido no site.</li>
        <li>Volte a esta página e atualize-a para continuar a compra.</li>
      </ol>
      <p className="text-xs text-muted">Nunca compartilhe seu código de vínculo com outra pessoa.</p>
      <Link className="button-primary" href="/account/profile#linked">Vincular minha conta Minecraft</Link>
    </div>}
  </section>;
}
