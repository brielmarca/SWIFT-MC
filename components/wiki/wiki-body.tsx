"use client";

import Link from "next/link";
import { AlertTriangle, ArrowRight, ArrowUpRight, Check, Copy, Info } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { WikiBlock, WikiSection } from "@/data/wiki";

function CommandBlock({ block, onCopy }: { block: Extract<WikiBlock, { type: "command" }>; onCopy: (command: string, ok: boolean) => void }) {
  const [copied, setCopied] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
  }, []);

  async function copy() {
    let ok = false;
    try {
      await navigator.clipboard.writeText(block.command);
      ok = true;
    } catch { ok = false; }
    setCopied(ok);
    onCopy(block.command, ok);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => setCopied(false), 2500);
  }

  return (
    <div className="overflow-hidden rounded-xl border border-violet/25 bg-black/40">
      <div className="flex items-center justify-between gap-3 border-b border-white/[0.06] px-4 py-2">
        <span className="micro-label">Comando</span>
        <button type="button" onClick={copy} className="button-copy-compact" aria-label={`Copiar comando ${block.command}`}>
          {copied ? <Check size={14} aria-hidden="true" /> : <Copy size={14} aria-hidden="true" />}
          {copied ? "Copiado" : "Copiar"}
        </button>
      </div>
      <pre className="overflow-x-auto px-4 py-3"><code className="whitespace-pre font-mono text-sm text-ultraviolet">{block.command}</code></pre>
      {block.note && <p className="border-t border-white/[0.06] px-4 py-2 text-xs leading-5 text-muted">{block.note}</p>}
    </div>
  );
}

function Callout({ block }: { block: Extract<WikiBlock, { type: "callout" }> }) {
  const warning = block.kind === "warning";
  const Icon = warning ? AlertTriangle : Info;
  return (
    <div className={`flex gap-3 rounded-xl border p-4 ${warning ? "border-amber-400/35 bg-amber-400/[0.07]" : "border-violet/35 bg-violet/10"}`}>
      <Icon size={18} aria-hidden="true" className={`mt-0.5 shrink-0 ${warning ? "text-amber-300" : "text-ultraviolet"}`} />
      <div className="min-w-0">
        {block.title && <p className="text-sm font-bold text-ink">{block.title}</p>}
        <p className={`text-sm leading-6 text-muted ${block.title ? "mt-1" : ""}`}>{block.text}</p>
      </div>
    </div>
  );
}

function BlockView({ block, onCopy }: { block: WikiBlock; onCopy: (command: string, ok: boolean) => void }) {
  if (block.type === "paragraph") return <p className="max-w-3xl text-base leading-7 text-muted">{block.text}</p>;

  if (block.type === "bullets") {
    return (
      <ul className="max-w-3xl space-y-3">
        {block.items.map((item) => (
          <li key={item} className="flex gap-3 text-base leading-7 text-muted">
            <span aria-hidden="true" className="mt-3 h-1.5 w-1.5 shrink-0 rounded-full bg-ultraviolet" />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    );
  }

  if (block.type === "steps") {
    return (
      <ol className="max-w-3xl space-y-3">
        {block.items.map((item, index) => (
          <li key={item} className="flex gap-3 text-base leading-7 text-muted">
            <span aria-hidden="true" className="mt-1 grid h-7 w-7 shrink-0 place-items-center rounded-full border border-violet/35 bg-violet/15 text-xs font-extrabold text-ultraviolet">{index + 1}</span>
            <span>{item}</span>
          </li>
        ))}
      </ol>
    );
  }

  if (block.type === "command") return <CommandBlock block={block} onCopy={onCopy} />;
  if (block.type === "callout") return <Callout block={block} />;

  if (block.type === "table") {
    return (
      <div className="max-w-3xl overflow-x-auto rounded-xl border border-white/[0.08]">
        <table className="w-full min-w-[480px] border-collapse text-sm">
          {block.caption && <caption className="micro-label border-b border-white/[0.06] px-4 py-3 text-left">{block.caption}</caption>}
          <thead>
            <tr className="bg-white/[0.04]">
              {block.headers.map((header) => <th key={header} scope="col" className="micro-label px-4 py-3 text-left">{header}</th>)}
            </tr>
          </thead>
          <tbody>
            {block.rows.map((row, rowIndex) => (
              <tr key={rowIndex} className="border-t border-white/[0.06]">
                {row.map((cell, cellIndex) => <td key={cellIndex} className="px-4 py-3 leading-6 text-muted">{cell}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  return (
    <ul className="grid max-w-3xl gap-3 sm:grid-cols-2">
      {block.items.map((item) => (
        <li key={item.href}>
          <Link href={item.href} className="flex h-full items-center gap-3 rounded-xl border border-white/[0.08] bg-card/70 p-4 transition hover:border-violet/40 hover:bg-elevated/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ultraviolet">
            <span aria-hidden="true" className="icon-well !h-9 !w-9 shrink-0"><ArrowUpRight size={16} /></span>
            <span className="min-w-0">
              <span className="block text-sm font-bold text-ink">{item.label}</span>
              {item.description && <span className="mt-0.5 block text-xs leading-5 text-muted">{item.description}</span>}
            </span>
            <ArrowRight size={15} aria-hidden="true" className="ml-auto shrink-0 text-muted transition group-hover:translate-x-1" />
          </Link>
        </li>
      ))}
    </ul>
  );
}

/** Renders guide sections with anchored headings, TOC targets and copyable command blocks. */
export function WikiBody({ sections }: { sections: readonly WikiSection[] }) {
  const [toast, setToast] = useState("");
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (timerRef.current) clearTimeout(timerRef.current);
  }, []);

  function handleCopy(command: string, ok: boolean) {
    setToast(ok ? `Comando copiado: ${command}` : "Não foi possível copiar. Selecione o comando e copie manualmente.");
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setToast(""), 3200);
  }

  return (
    <div>
      <div className="space-y-12">
        {sections.map((section) => (
          <section key={section.id} id={section.id} aria-labelledby={`wiki-${section.id}-title`} className="scroll-mt-28">
            <h2 id={`wiki-${section.id}-title`} className="text-2xl font-bold leading-8 text-ink">{section.title}</h2>
            <div className="mt-5 space-y-5">
              {section.blocks.map((block, index) => <BlockView key={index} block={block} onCopy={handleCopy} />)}
            </div>
          </section>
        ))}
      </div>
      <span role="status" aria-live="polite" aria-atomic="true" className="sr-only">{toast}</span>
      {toast && createPortal(<div aria-hidden="true" className="cart-toast cart-toast-visible">{toast}</div>, document.body)}
    </div>
  );
}
