"use client";

import Script from "next/script";
import { useEffect, useRef, useState } from "react";

type TurnstileApi = {
  render(element: HTMLElement, options: {
    sitekey: string;
    action: string;
    theme: "dark";
    size: "flexible";
    "response-field": boolean;
    callback: (token: string) => void;
    "expired-callback": () => void;
    "error-callback": () => void;
  }): string;
  remove(widgetId: string): void;
  reset(widgetId: string): void;
};

type TurnstileWindow = Window & { turnstile?: TurnstileApi };

export function TurnstileWidget({
  siteKey, action, onToken, resetSignal,
}: {
  siteKey: string;
  action: "register" | "login" | "forgot";
  onToken: (token: string | null) => void;
  resetSignal: number;
}) {
  const container = useRef<HTMLDivElement>(null);
  const widgetId = useRef<string | null>(null);
  const lastReset = useRef(resetSignal);
  const [scriptReady, setScriptReady] = useState(false);

  useEffect(() => {
    const api = (window as TurnstileWindow).turnstile;
    if (!scriptReady || !api || !container.current) return;
    widgetId.current = api.render(container.current, {
      sitekey: siteKey,
      action,
      theme: "dark",
      size: "flexible",
      "response-field": false,
      callback: onToken,
      "expired-callback": () => onToken(null),
      "error-callback": () => onToken(null),
    });
    return () => {
      if (widgetId.current) api.remove(widgetId.current);
      widgetId.current = null;
      onToken(null);
    };
  }, [scriptReady, siteKey, action, onToken]);

  useEffect(() => {
    if (lastReset.current === resetSignal) return;
    lastReset.current = resetSignal;
    const api = (window as TurnstileWindow).turnstile;
    if (widgetId.current && api) api.reset(widgetId.current);
    onToken(null);
  }, [resetSignal, onToken]);

  return <div className="auth-turnstile" aria-label="Verificação humana">
    <Script
      src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
      strategy="afterInteractive"
      onReady={() => setScriptReady(true)}
    />
    <div ref={container} />
  </div>;
}
