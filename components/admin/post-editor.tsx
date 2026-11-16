"use client";

import { useRouter } from "next/navigation";
import { useState, type SyntheticEvent } from "react";
import { PostImageUpload } from "./post-image-upload";
import { extractCsrfTokenFromCookie } from "@/lib/auth-client";

export type EditorInitial = {
  id: string;
  revision: number;
  title: string;
  slug: string;
  excerpt: string;
  category: "Notícias" | "Patch Notes" | "Avisos";
  tags: string;
  body: string;
  status: "DRAFT" | "PUBLISHED" | "ARCHIVED";
  featured: boolean;
  imageAlt?: string | null;
  imageMime?: string | null;
};

const empty: EditorInitial = {
  id: "", revision: 1, title: "", slug: "", excerpt: "", category: "Notícias",
  tags: "", body: "", status: "DRAFT", featured: false, imageAlt: "",
};

function slugify(input: string): string {
  return input.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 110).replace(/-$/g, "");
}

export function PostEditor({ initial }: { initial?: EditorInitial }) {
  const router = useRouter();
  const [post, setPost] = useState(initial ?? empty);
  const [saving, setSaving] = useState(false);
  const [alert, setAlert] = useState<{ ok: boolean; message: string } | null>(null);
  const editing = Boolean(initial?.id);
  const archived = post.status === "ARCHIVED";

  function field<K extends keyof EditorInitial>(key: K, value: EditorInitial[K]) {
    setPost(previous => ({ ...previous, [key]: value }));
  }

  async function submit(event: SyntheticEvent, status: "DRAFT" | "PUBLISHED") {
    event.preventDefault();
    if (saving || archived) return;
    const csrf = extractCsrfTokenFromCookie();
    if (!csrf) { setAlert({ ok: false, message: "Sessão de segurança indisponível. Entre novamente e atualize a página." }); return; }
    setSaving(true); setAlert(null);
    try {
      const path = editing ? `/api/admin/posts/${encodeURIComponent(post.id)}` : "/api/admin/posts";
      const response = await fetch(path, {
        method: editing ? "PATCH" : "POST",
        credentials: "same-origin",
        cache: "no-store",
        headers: { "Content-Type": "application/json", "X-CSRF-Token": csrf },
        body: JSON.stringify({
          title: post.title, slug: post.slug, excerpt: post.excerpt,
          category: post.category, tags: post.tags, body: post.body,
          featured: post.featured, status, ...(editing ? { revision: post.revision } : {}),
        }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result?.error?.message ?? "Não foi possível salvar.");
      setPost(previous => ({ ...previous, id: result.id || previous.id, revision: result.revision, status }));
      setAlert({ ok: true, message: status === "PUBLISHED" ? "Publicação disponível para os jogadores." : "Rascunho salvo. Não está público." });
      if (!editing) router.replace(`/admin/posts/${encodeURIComponent(result.id)}`);
      router.refresh();
    } catch (error) {
      setAlert({ ok: false, message: error instanceof Error ? error.message : "Falha de conexão." });
    } finally { setSaving(false); }
  }

  async function archive() {
    if (!editing || archived || saving || !window.confirm("Arquivar a publicação? Ela deixará de aparecer para os jogadores.")) return;
    const csrf = extractCsrfTokenFromCookie();
    if (!csrf) { setAlert({ ok: false, message: "Atualize a página para restaurar a sessão de segurança." }); return; }
    setSaving(true); setAlert(null);
    try {
      const response = await fetch(`/api/admin/posts/${encodeURIComponent(post.id)}`, {
        method: "DELETE", credentials: "same-origin", cache: "no-store",
        headers: { "Content-Type": "application/json", "X-CSRF-Token": csrf },
        body: JSON.stringify({ revision: post.revision }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result?.error?.message ?? "Não foi possível arquivar.");
      router.push("/admin/posts");
      router.refresh();
    } catch (error) {
      setAlert({ ok: false, message: error instanceof Error ? error.message : "Falha de conexão." });
    } finally { setSaving(false); }
  }

  return (
    <>
    <div className="grid gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(280px,1fr)]">
      <section className="glass-panel p-5 sm:p-7">
        <form onSubmit={event => void submit(event, "DRAFT")} className="space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-extrabold text-ink">{editing ? "Editar publicação" : "Criar publicação"}</h2>
            <span className={`rounded-md border px-3 py-1 text-xs font-bold ${post.status === "PUBLISHED" ? "border-emerald-400/40 text-emerald-200" : "border-white/20 text-muted"}`}>{post.status === "PUBLISHED" ? "PUBLICADA" : archived ? "ARQUIVADA" : "RASCUNHO"}</span>
          </div>
          <div><label htmlFor="cms-title" className="mb-2 block text-sm font-bold">Título</label>
            <input id="cms-title" className="checkout-input w-full" required minLength={5} maxLength={180}
              disabled={archived || saving} value={post.title} onChange={event => {
                const title = event.target.value;
                setPost(previous => ({ ...previous, title, ...(!editing ? { slug: slugify(title) } : {}) }));
              }} placeholder="Ex.: Atualização de novembro — Survival" /></div>
          <div><label htmlFor="cms-slug" className="mb-2 block text-sm font-bold">Endereço da notícia</label>
            <div className="flex items-center gap-2"><span className="text-xs text-muted">/news/</span><input id="cms-slug" className="checkout-input w-full" required maxLength={110} pattern="[a-z0-9]+(-[a-z0-9]+)*"
              value={post.slug} onChange={event => field("slug", slugify(event.target.value))} readOnly={editing} disabled={archived || saving} /></div>
            <p className="mt-1 text-xs text-muted">O endereço é permanente após a criação; evite usar títulos provisórios.</p></div>
          <div><label htmlFor="cms-category" className="mb-2 block text-sm font-bold">Tipo</label>
            <select id="cms-category" className="checkout-input w-full" value={post.category} disabled={archived || saving} onChange={event => field("category", event.target.value as EditorInitial["category"])}>
              <option>Notícias</option><option>Patch Notes</option><option>Avisos</option>
            </select></div>
          <div><label htmlFor="cms-excerpt" className="mb-2 block text-sm font-bold">Resumo (aparece na página inicial)</label>
            <textarea id="cms-excerpt" className="checkout-input min-h-24 w-full" required minLength={15} maxLength={350} disabled={archived || saving} value={post.excerpt} onChange={event => field("excerpt", event.target.value)} placeholder="Resuma as mudanças em uma ou duas frases." /></div>
          <div><label htmlFor="cms-body" className="mb-2 block text-sm font-bold">Conteúdo</label>
            <textarea id="cms-body" className="checkout-input min-h-72 w-full font-mono text-sm" required minLength={20} maxLength={20000} disabled={archived || saving} value={post.body} onChange={event => field("body", event.target.value)}
              placeholder={"Escreva a atualização aqui.\n\n## Melhorias\n- Servidor mais estável\n- Novos ajustes de economia\n\nObrigado por jogar!"} />
            <p className="mt-1 text-xs text-muted">Use ## antes de subtítulos e - antes dos itens de lista. Não aceita HTML.</p></div>
          <div><label htmlFor="cms-tags" className="mb-2 block text-sm font-bold">Tags (opcional)</label>
            <input id="cms-tags" className="checkout-input w-full" maxLength={350} disabled={archived || saving} value={post.tags} onChange={event => field("tags", event.target.value)} placeholder="survival, atualizacao, economia" /></div>
          <label className="flex items-center gap-3 text-sm text-ink"><input type="checkbox" checked={post.featured} disabled={archived || saving} onChange={event => field("featured", event.target.checked)} /> Destacar esta publicação</label>
          {alert && <p role={alert.ok ? "status" : "alert"} className={`rounded-lg border p-3 text-sm ${alert.ok ? "border-emerald-500/30 text-emerald-200" : "border-rose-500/30 text-rose-200"}`}>{alert.message}</p>}
          <div className="flex flex-wrap gap-3 border-t border-white/10 pt-5">
            <button type="submit" className="button-secondary" disabled={archived || saving}>{saving ? "Salvando..." : post.status === "PUBLISHED" ? "Despublicar / salvar rascunho" : "Salvar rascunho"}</button>
            <button type="button" className="button-primary" disabled={archived || saving} onClick={event => void submit(event, "PUBLISHED")}>{saving ? "Salvando..." : post.status === "PUBLISHED" ? "Salvar alterações publicadas" : "Publicar agora"}</button>
            {editing && <button type="button" className="rounded-lg border border-rose-400/40 px-4 py-2 text-sm font-bold text-rose-200 disabled:opacity-50" onClick={() => void archive()} disabled={archived || saving}>Arquivar</button>}
          </div>
        </form>
      </section>
      <div className="space-y-6">
      <aside className="glass-panel h-fit p-5 sm:p-6" aria-label="Pré-visualização da publicação">
        <p className="eyebrow">Pré-visualização</p>
        <p className="mt-3 text-xs font-bold uppercase text-ultraviolet">{post.category}</p>
        <h3 className="mt-3 break-words text-2xl font-extrabold text-ink">{post.title || "Título da notícia"}</h3>
        <p className="mt-3 break-words text-sm text-muted">{post.excerpt || "O resumo aparecerá aqui."}</p>
        <div className="mt-5 max-h-96 space-y-2 overflow-auto border-t border-white/10 pt-4 text-sm text-muted">
          {post.body.split("\n").map((line, index) => <p key={index} className="break-words whitespace-pre-wrap">{line || "\u00a0"}</p>)}
        </div>
        <p className="mt-5 text-xs text-muted">Este quadro é uma prévia simplificada. A notícia pública usa o layout oficial da SwiftMC.</p>
      </aside>
    </div>
    </div>
    {editing && !archived && <PostImageUpload key={post.id} id={post.id} revision={post.revision}
      initialAlt={post.imageAlt ?? ""} hasImage={Boolean(post.imageMime)}
      onChanged={(revision, present, alt) => setPost(previous => ({ ...previous, revision, imageMime: present ? "image/webp" : null, imageAlt: present ? alt : null }))} />}
    {!editing && <p className="mt-5 text-sm text-muted">Depois de salvar a primeira versão, você poderá enviar uma imagem para a publicação.</p>}
    </>
  );
}
