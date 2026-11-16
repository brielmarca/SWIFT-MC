"use client";

import { useState, type FormEvent } from "react";
import Image from "next/image";
import { extractCsrfTokenFromCookie } from "@/lib/auth-client";

type Props = {
  id: string;
  revision: number;
  hasImage: boolean;
  initialAlt: string;
  onChanged: (revision: number, present: boolean, alt: string) => void;
};

const MAX_UPLOAD_BYTES = 700_000;

function canvasBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => canvas.toBlob(blob => {
    if (blob && blob.type === "image/webp") resolve(blob);
    else reject(new Error("Seu navegador não conseguiu converter a imagem para WebP."));
  }, "image/webp", quality));
}

async function compressPicture(file: File): Promise<File> {
  if (file.size > 12_000_000) throw new Error("Imagem original muito grande (máximo 12 MB).");
  if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) throw new Error("Aceitamos somente PNG, JPG ou WebP.");
  const bitmap = await createImageBitmap(file);
  try {
    const ratio = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
    if (bitmap.width <= 0 || bitmap.height <= 0 || bitmap.width * bitmap.height > 24_000_000) throw new Error("Resolução inválida ou muito alta.");
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * ratio));
    canvas.height = Math.max(1, Math.round(bitmap.height * ratio));
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Não foi possível processar a imagem.");
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    for (const quality of [0.82, 0.68, 0.52, 0.38]) {
      const blob = await canvasBlob(canvas, quality);
      if (blob.size <= MAX_UPLOAD_BYTES && blob.size >= 32) {
        return new File([blob], "capa.webp", { type: "image/webp" });
      }
    }
    throw new Error("Não foi possível reduzir a imagem abaixo de 700 KB. Tente uma menor.");
  } finally { bitmap.close(); }
}

export function PostImageUpload({ id, revision, hasImage, initialAlt, onChanged }: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [alt, setAlt] = useState(initialAlt);
  const [imagePresent, setImagePresent] = useState(hasImage);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [version, setVersion] = useState(0);

  async function upload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!file || pending) return;
    const csrf = extractCsrfTokenFromCookie();
    if (!csrf) { setMessage({ ok: false, text: "Sessão CSRF indisponível. Recarregue a página." }); return; }
    setPending(true); setMessage(null);
    try {
      const optimized = await compressPicture(file);
      const body = new FormData();
      body.set("image", optimized); body.set("alt", alt); body.set("revision", String(revision));
      const res = await fetch(`/api/admin/posts/${encodeURIComponent(id)}/image`, {
        method: "POST", credentials: "same-origin", cache: "no-store", headers: { "X-CSRF-Token": csrf }, body,
      });
      const result = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(result?.error?.message || "Falha no upload.");
      onChanged(result.revision, true, alt); setImagePresent(true); setVersion(v => v + 1); setFile(null);
      setMessage({ ok: true, text: "Imagem enviada e salva! Ela aparece na notícia quando a publicação estiver pública." });
    } catch (error) { setMessage({ ok: false, text: error instanceof Error ? error.message : "Falha ao enviar imagem." }); }
    finally { setPending(false); }
  }

  async function remove() {
    if (!imagePresent || pending || !window.confirm("Remover esta imagem da publicação?")) return;
    const csrf = extractCsrfTokenFromCookie();
    if (!csrf) { setMessage({ ok: false, text: "Recarregue a página para continuar." }); return; }
    setPending(true); setMessage(null);
    try {
      const res = await fetch(`/api/admin/posts/${encodeURIComponent(id)}/image`, {
        method: "DELETE", credentials: "same-origin", cache: "no-store",
        headers: { "Content-Type": "application/json", "X-CSRF-Token": csrf },
        body: JSON.stringify({ revision }),
      });
      const result = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(result?.error?.message || "Não foi possível remover.");
      onChanged(result.revision, false, ""); setImagePresent(false); setAlt("");
      setMessage({ ok: true, text: "Imagem removida." });
    } catch (error) { setMessage({ ok: false, text: error instanceof Error ? error.message : "Falha ao remover." }); }
    finally { setPending(false); }
  }

  return <section className="glass-panel mt-6 p-5 sm:p-7" aria-label="Imagem da publicação">
    <h2 className="text-lg font-extrabold text-ink">Imagem de capa</h2>
    <p className="mt-2 text-sm text-muted">PNG, JPG ou WebP. A imagem é convertida em WebP e reduzida automaticamente. Até 12 MB de origem e 700 KB após otimização.</p>
    {imagePresent && <div className="relative mt-4 aspect-video max-h-64 w-full overflow-hidden rounded-lg border border-white/10">
      <Image src={`/api/admin/posts/${encodeURIComponent(id)}/image?v=${version}`} alt={alt || "Imagem atual da publicação"} fill unoptimized sizes="(max-width: 768px) 100vw, 50vw" className="object-contain" />
    </div>}
    <form onSubmit={event => void upload(event)} className="mt-4 space-y-4">
      <div>
        <label htmlFor="post-cover" className="mb-2 block text-sm font-bold text-ink">Escolher imagem</label>
        <input id="post-cover" type="file" accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp" className="block w-full text-sm text-muted file:mr-4 file:rounded-lg file:border-0 file:bg-violet/20 file:px-4 file:py-2 file:text-ink"
          onChange={event => setFile(event.target.files?.[0] ?? null)} disabled={pending} />
      </div>
      <div>
        <label htmlFor="post-cover-alt" className="mb-2 block text-sm font-bold text-ink">Descrição acessível da imagem</label>
        <input id="post-cover-alt" type="text" required minLength={5} maxLength={180} className="checkout-input w-full" value={alt} onChange={event => setAlt(event.target.value)}
          placeholder="Ex.: Arte da atualização do Survival" disabled={pending} />
      </div>
      {message && <p role={message.ok ? "status" : "alert"} className={`text-sm ${message.ok ? "text-emerald-200" : "text-rose-200"}`}>{message.text}</p>}
      <div className="flex flex-wrap gap-3">
        <button type="submit" className="button-primary" disabled={pending || !file || alt.trim().length < 5}>{pending ? "Processando imagem..." : imagePresent ? "Substituir imagem" : "Enviar imagem"}</button>
        {imagePresent && <button type="button" className="button-secondary" disabled={pending} onClick={() => void remove()}>Remover imagem</button>}
      </div>
    </form>
  </section>;
}
