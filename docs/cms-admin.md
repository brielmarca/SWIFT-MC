# SwiftMC CMS — ADMIN/OWNER

Criação e edição de notícias, patch notes e avisos em `/admin/posts`, com MFA, CSRF, checagem de Origin, auditoria e bloqueio contra sobrescrever revisões concorrentes. As notícias são texto puro, com `##` para subtítulo e `- ` para lista. A publicação ocorre imediatamente; não há agendamento, upload de arquivos ou editor HTML arbitrário nesta versão. Excluir equivale a arquivar (soft delete).

A tabela `ContentPost` deve ser migrada antes de usar a interface. Publicações só aparecem em `/news`, `/news/<slug>` e no teaser da home quando `status = PUBLISHED` e `publishedAt <= NOW()`; demais não podem ser consultadas anonimamente. Os slugs são estáveis após criação e não podem ser reutilizados. O sitemap inclui as publicações do banco depois da migração. Não cachear `/admin*`, `/api/admin*` ou conteúdo autenticado.

O gateway Cloudflare de staging precisa preservar as rotas `/admin` e `/api/admin` e a conta ADMIN/OWNER precisa concluir MFA. A homepage agora é renderizada dinamicamente para evitar novidades desatualizadas por cache. Fazer o deploy primeiro em staging e testar rascunho -> publicação -> edição -> despublicação -> arquivamento, inclusive tentando acesso como USER. Não alterar produção automaticamente.


## Imagens
O editor permite enviar PNG, JPEG ou WebP após salvar a primeira versão do post. O navegador comprime a imagem para WebP, com largura/altura máxima de 1600px, limite de 700 KB e 12 MB no arquivo original. A API exige ADMIN/OWNER com MFA, Origin exato, CSRF, magic bytes e uma revisão atual do post. O servidor armazena os dados na coluna BYTEA; imagens públicas só são retornadas enquanto o post estiver publicado, com `no-store`, sem cache de otimização do Next. Upload em rascunho é visível apenas na prévia autenticada. Um post arquivado não pode receber novo upload.

## Loja e status
Os cards VIP agora exibem somente "Adicionar ao carrinho" e "Saiba mais". A navegação para checkout permanece no carrinho, rotulada "Finalizar compra". O status da rede e os jogadores conectados aparecem na home e no cabeçalho da loja, atualizados pelo endpoint público existente; caso o Minecraft não responda, exibe estado indisponível sem inventar contagens.
