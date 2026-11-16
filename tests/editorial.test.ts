import assert from "node:assert/strict";
import test from "node:test";
import { postSchema, updatePostSchema, parseArticleBody, normalizePostTags } from "@/lib/editorial/validation";
import { validateEditorImage, MAX_EDITOR_IMAGE_BYTES } from "@/lib/editorial/image-validation";

const valid = {
  title: "Atualização do Survival", slug: "atualizacao-survival",
  excerpt: "Confira as melhorias e correções de hoje.",
  category: "Patch Notes", tags: "minecraft, survival",
  body: "## Melhorias\n- Nova loja\n- Correções no spawn\n\nServidor disponível a todos.",
  featured: false, status: "DRAFT",
};

test("editorial validation only allows approved post types, statuses, and unique slugs", () => {
  assert.equal(postSchema.parse(valid).category, "Patch Notes");
  assert.equal(postSchema.safeParse({ ...valid, category: "Outro" }).success, false);
  assert.equal(postSchema.safeParse({ ...valid, status: "ARCHIVED" }).success, false);
  assert.equal(postSchema.safeParse({ ...valid, slug: "../admin" }).success, false);
  assert.equal(postSchema.safeParse({ ...valid, attacker: true }).success, false);
  assert.equal(updatePostSchema.safeParse({ ...valid, revision: 1 }).success, true);
  assert.equal(updatePostSchema.safeParse({ ...valid, revision: 0 }).success, false);
  assert.equal(updatePostSchema.safeParse({ ...valid, revision: 1.2 }).success, false);
});

test("editorial tags deduplicate and article blocks remain inert text", () => {
  assert.equal(normalizePostTags("Survival, survival, Atualização"), "survival,atualização");
  assert.throws(() => normalizePostTags("<script>"));
  assert.throws(() => normalizePostTags(Array.from({ length: 11 }, (_, i) => "tag" + i).join(",")));
  assert.deepEqual(parseArticleBody("## Novidades\n- Item 1\n- Item 2\n\nTexto <script>inofensivo</script>."), [
    { type: "heading", text: "Novidades" }, { type: "list", items: ["Item 1", "Item 2"] },
    { type: "paragraph", text: "Texto <script>inofensivo</script>." },
  ]);
});

test("image uploads enforce MIME signature, alt text, and byte length", async () => {
  const bytes = new Uint8Array(40); bytes.set([82, 73, 70, 70], 0); bytes.set([87, 69, 66, 80], 8);
  const file = new File([bytes], "cover.webp", { type: "image/webp" });
  const validImage = await validateEditorImage(file, "Banner do Survival");
  assert.equal(validImage.mime, "image/webp");
  assert.equal(validImage.data.byteLength, 40);
  await assert.rejects(validateEditorImage(file, "a"));
  await assert.rejects(validateEditorImage(new File([bytes], "polyglot.svg", { type: "image/svg+xml" }), "Banner suspeito"));
  await assert.rejects(validateEditorImage(new File([new Uint8Array(MAX_EDITOR_IMAGE_BYTES + 1)], "huge.webp", { type: "image/webp" }), "Banner grande"));
});
