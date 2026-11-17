"use client";

import { useMemo, useState } from "react";
import QRCode from "qrcode-svg";

/**
 * The TOTP enrollment QR is generated on the user's device.
 * Never send an otpauth URI (which includes the MFA secret) to a QR API/CDN.
 */
export function MfaQrCode({ uri }: { uri: string }) {
  const [showManual, setShowManual] = useState(false);
  const { imageUrl, secret } = useMemo(() => {
    try {
      const parsed = new URL(uri);
      if (parsed.protocol !== "otpauth:" || parsed.hostname !== "totp") {
        return { imageUrl: null, secret: null };
      }
      const secret = parsed.searchParams.get("secret");
      if (!secret || !/^[A-Z2-7]+$/.test(secret)) {
        return { imageUrl: null, secret: null };
      }
      const svg = new QRCode({
        content: uri,
        padding: 4,
        width: 264,
        height: 264,
        color: "#111827",
        background: "#ffffff",
        ecl: "M",
        join: true,
        xmlDeclaration: false,
      }).svg();
      return { imageUrl: "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg), secret };
    } catch {
      return { imageUrl: null, secret: null };
    }
  }, [uri]);

  return (
    <div className="space-y-3">
      {imageUrl ? (
        <div className="inline-flex rounded-xl border border-white/10 bg-white p-3">
          {/* A local data: image preserves the secret on-device; Next image optimization would send it to a server. */}
          <img src={imageUrl} width={264} height={264} alt="QR Code para configurar a autenticação de dois fatores" className="h-[264px] w-[264px] max-w-full" />
        </div>
      ) : (
        <p role="alert" className="text-sm text-rose-200">
          Não foi possível gerar o QR Code. Gere outra chave ou utilize a configuração manual.
        </p>
      )}
      <p className="text-xs text-muted">
        No aplicativo autenticador, escolha Adicionar conta → Escanear QR Code. A imagem é gerada localmente, sem compartilhar a chave com sites externos.
      </p>
      <button type="button" className="text-sm font-semibold text-ultraviolet underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet"
        aria-expanded={showManual} onClick={() => setShowManual(v => !v)}>
        {showManual ? "Ocultar chave manual" : "Não consegue escanear? Mostrar chave manual"}
      </button>
      {showManual && (
        <div className="rounded-lg border border-amber-400/20 bg-amber-500/5 p-3 text-xs">
          <p className="mb-2 font-semibold text-amber-100">Chave privada de configuração</p>
          {secret
            ? <code className="block select-all break-all font-mono text-ink">{secret}</code>
            : <p role="alert" className="text-rose-200">Chave indisponível. Gere outra configuração.</p>}
          <p className="mt-2 text-muted">Tipo: baseado em tempo (TOTP) · 6 dígitos · intervalo de 30 segundos.</p>
          <p className="mt-2 text-amber-100">Nunca compartilhe esta chave nem envie prints da tela.</p>
        </div>
      )}
    </div>
  );
}
