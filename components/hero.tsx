import { Server, ShieldCheck, ShoppingBag, Zap } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { CopyIpButton } from "./copy-ip-button";
import { ServerAddress, ServerStatusChip } from "./server-status-provider";

const trustStats = [
  { value: "Survival", label: "Modo de jogo" },
  { value: "mcMMO", label: "Habilidades", accent: true },
  { value: "Vitalícios", label: "Ranks da loja" },
];

export function Hero() {
  return (
    <section id="inicio" className="relative overflow-hidden py-8 lg:py-24">
      <div className="ambient ambient-left" />
      <div className="ambient ambient-right" />
      <div className="site-container grid items-center gap-8 lg:grid-cols-12 lg:gap-6">
        <div className="flex flex-col items-start gap-6 lg:col-span-7">
          <ServerStatusChip />

          <div>
            <h1 className="max-w-4xl text-4xl font-extrabold uppercase leading-[1.05] tracking-[-0.04em] text-ink sm:text-5xl lg:text-[3.5rem]">
              <span className="block">A melhor experiência</span>
              <span className="gradient-text block">Survival Minecraft</span>
            </h1>
            <p className="mt-4 max-w-xl text-base leading-6 text-muted">
              Economia balanceada, proteção total de terrenos, sistema de habilidades mcMMO, dungeons customizadas e uma comunidade acolhedora pronta para te receber.
            </p>
          </div>

          <div className="glass-panel flex w-full max-w-xl flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-center gap-4">
              <span className="icon-well shrink-0"><Server size={22} aria-hidden="true" /></span>
              <div className="min-w-0">
                <span className="micro-label">Direct connect host</span>
                <p className="truncate font-mono text-lg font-bold tracking-wide text-ink"><ServerAddress /></p>
                <p className="mt-0.5 text-xs text-muted">
                  Copie o endereço e adicione à lista de servidores Java.
                </p>
              </div>
            </div>
            <CopyIpButton />
          </div>

          <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
            <Link href="/play" className="button-primary">Como jogar</Link>
            <Link href="#loja" className="button-secondary">
              <ShoppingBag size={18} className="text-ultraviolet" aria-hidden="true" /> Ver loja e ranks
            </Link>
          </div>

          <dl className="grid w-full max-w-xl grid-cols-3 gap-2 pt-4 sm:gap-4">
            {trustStats.map((stat) => (
              <div key={stat.label} className="min-w-0">
                <dt className="micro-label mt-1">{stat.label}</dt>
                <dd className={`mt-1 text-lg font-bold tracking-tight sm:text-2xl ${stat.accent ? "text-ultraviolet" : "text-ink"}`}>{stat.value}</dd>
              </div>
            ))}
          </dl>
        </div>

        <div className="relative mx-auto w-full max-w-[420px] lg:col-span-5">
          <div className="hero-stage">
            <div className="stage-grid" />
            <div className="absolute left-3 top-3 z-20 flex items-center gap-1.5 rounded-lg border border-white/10 bg-void/75 px-2.5 py-1.5 text-[8px] font-bold uppercase tracking-[0.1em] text-ink backdrop-blur sm:left-5 sm:top-5 sm:gap-2 sm:px-3 sm:py-2 sm:text-[10px] sm:tracking-[0.14em]">
              <Zap size={14} className="text-ultraviolet" aria-hidden="true" /> Survival custom
            </div>
            <Image
              src="/brand/emblem.png"
              alt="Emblema roxo oficial da SWIFT MC"
              width={1316}
              height={1195}
              priority
              sizes="(max-width: 1024px) 80vw, 420px"
              className="relative z-10 h-auto w-[86%] object-contain drop-shadow-[0_0_32px_rgba(168,85,247,0.42)]"
            />
            <div className="absolute bottom-3 left-3 z-20 flex items-center gap-1.5 rounded-lg border border-white/10 bg-void/75 px-2.5 py-1.5 text-[8px] font-bold uppercase tracking-[0.1em] text-ink backdrop-blur sm:bottom-5 sm:left-5 sm:gap-2 sm:px-3 sm:py-2 sm:text-[10px] sm:tracking-[0.14em]">
              <ShieldCheck size={14} className="text-ultraviolet" aria-hidden="true" /> Terrenos e guildas
            </div>
            <div className="absolute right-2 top-1/2 z-20 flex -translate-y-1/2 items-center gap-1.5 rounded-lg border border-violet/25 bg-void/85 px-2 py-1.5 text-[8px] font-bold uppercase tracking-[0.08em] text-ultraviolet backdrop-blur sm:right-3 sm:gap-2 sm:px-3 sm:py-2 sm:text-[10px] sm:tracking-[0.14em]">
              <ShieldCheck size={14} aria-hidden="true" /> Survival SWIFT MC
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
