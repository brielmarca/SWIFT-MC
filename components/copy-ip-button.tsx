"use client";

import { Check, Copy, Gamepad2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useServerStatus } from "./server-status-provider";

type CopyIpButtonProps = {
  compact?: boolean;
  play?: boolean;
};

export function CopyIpButton({ compact = false, play = false }: CopyIpButtonProps) {
  const { publicAddress } = useServerStatus();
  const [feedback, setFeedback] = useState("");
  const [copied, setCopied] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
  }, []);

  async function copyIp() {
    try {
      await navigator.clipboard.writeText(publicAddress);
      setCopied(true);
      setFeedback("IP copiado! Cole o endereço na lista de servidores do Minecraft.");
    } catch {
      setCopied(false);
      setFeedback(`Não foi possível copiar. Copie manualmente: ${publicAddress}`);
    }
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => { setCopied(false); setFeedback(""); }, 4500);
  }

  const Icon = copied ? Check : play ? Gamepad2 : Copy;

  return (
    <><button
      type="button"
      onClick={copyIp}
      className={play ? "button-primary" : compact ? "button-copy-compact" : "button-secondary w-full sm:w-auto"}
      aria-label={`Copiar endereço ${publicAddress}`}
    >
      <Icon size={18} aria-hidden="true" />
      <span>{copied ? "Copiado" : play ? "Jogar agora" : "Copiar IP"}</span>
    </button>
    <span role="status" aria-live="polite" aria-atomic="true" className="sr-only">{feedback}</span>
    {feedback && createPortal(<div aria-hidden="true" className="cart-toast cart-toast-visible">{feedback}</div>, document.body)}</>
  );
}
