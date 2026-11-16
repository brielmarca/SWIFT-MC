"use client";
import { useState, type ChangeEvent } from "react";
import { extractCsrfTokenFromCookie } from "@/lib/auth-client";

const MAX_SOURCE = 2 * 1024 * 1024;
const MAX_RESULT = 1024 * 1024;
const MAX_WIDTH = 1600;

function webpBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) =>
    canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error("Falha na conversão.")), "image/webp", quality));
}

async function optimize(file: File): Promise<Blob> {
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) throw new Error("Use PNG, JPG ou WebP.");
  if (file.size > MAX_SOURCE) throw new Error("A imagem original não pode passar de 2 MB.");
  const bitmap = await createImageBitmap(file);
  try {
    if (bitmap.width * bitmap.height > 24_000_000) throw new Error("Resolução muito alta.");
    const scale = Math.min(1, MAX_WIDTH / bitmap.width);
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Não foi possível processar a imagem.");
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    for (const quality of [0.8, 0.65, 0.5]) {
      const blob = await webpBlob(canvas, quality);
      if (blob.type !== "image/webp") throw new Error("WebP não é suportado neste navegador.");
      if (blob.size <= MAX_RESULT) return blob;
    }
    throw new Error("Imagem não coube em 1 MB. Reduza a resolução.");
  } finally { bitmap.close(); }
}

export function MediaUpload() {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ url: string; size: number } | null>(null);
  const [message, setMessage] = useState("");
  async function onFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setBusy(true); setMessage(""); setResult(null);
    try {
      const csrf = extractCsrfTokenFromCookie();
      if (!csrf) throw new Error("Sessão inválida. Recarregue a página.");
      const blob = await optimize(file);
      const response = await fetch("/api/admin/media", {
        method: "POST", headers: { "Content-Type": "image/webp", "X-CSRF-Token": csrf }, body: blob,
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error?.message ?? "Falha no upload.");
      setResult({ url: json.url, size: json.size });
      setMessage("Imagem enviada com sucesso.");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Não foi possível enviar.");
    } finally {
      setBusy(false); event.target.value = "";
    }
  }
  return <div className="space-y-4">
    <label htmlFor="media-file" className="block font-semibold text-ink">Enviar imagem</label>
    <input id="media-file" type="file" accept="image/png,image/jpeg,image/webp" onChange={onFile} disabled={busy} className="block w-full text-sm text-ink" />
    <p className="text-sm text-muted">PNG, JPG ou WebP. Original até 2 MB. Otimização automática para WebP, largura máxima de 1600 px e arquivo final até 1 MB.</p>
    {busy && <p role="status">Otimizando e enviando…</p>}
    {message && <p role={result ? "status" : "alert"} className="text-sm text-ink">{message}</p>}
    {result && <div className="space-y-3">
      {/* Uploaded bytes are only served through the media endpoint. */}
      <img src={result.url} alt="Prévia da imagem enviada" className="max-h-72 max-w-full rounded-lg object-contain" />
      <p className="text-xs text-muted">Tamanho armazenado: {(result.size / 1024).toFixed(0)} KB</p>
      <label htmlFor="media-url" className="block text-sm font-semibold text-ink">URL para usar na publicação</label>
      <input id="media-url" className="checkout-input w-full" value={result.url} readOnly onFocus={e=>e.target.select()} />
      <button type="button" className="button-secondary" onClick={() => navigator.clipboard.writeText(new URL(result.url, window.location.origin).href)}>Copiar URL</button>
    </div>}
  </div>;
}
