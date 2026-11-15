# SwiftMC — Entrada administrativa discreta

## Comportamento
- A conta normal não exibe botão/link para o painel administrativo nem sinaliza publicamente o papel `OWNER`/`ADMIN` na página de perfil.
- As páginas `/admin/*` não aparecem no sitemap público e recebem `X-Robots-Tag: noindex, nofollow, noarchive`, `Cache-Control: private, no-store` e `Referrer-Policy: no-referrer`.
- O `robots.txt` do domínio principal desaconselha rastreamento em `/admin`. A rota de acesso **continua sendo** `/admin` para administradores autenticados.
- O próprio menu de administração fica disponível **apenas depois da autenticação** no painel.

## Segurança real
- Ocultar navegação e desencorajar indexação não impede que alguém descubra ou digite a URL.
- Não usar URL secreta como autorização. A aplicação continua validando sessão ativa, papel com permissão, MFA elevado e verificações server-side em cada página e endpoint.
- Não desabilitar acesso normal a `/login`, `/account` ou `/admin/security`, para manter o processo legítimo de elevação e configuração de MFA.
- Para dificultar abuso, manter rate limiting, auditoria, política de senhas, MFA e gateway restrito. Mudanças adicionais exigem validação para não bloquear administradores legítimos.
